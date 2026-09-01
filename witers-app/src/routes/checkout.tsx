import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";
import { z } from "zod";

import { WitersLogo } from "../components/witers/brand";
import {
  currentPriceFor,
  getPlan,
  isPlanId,
  withIva,
  type MembershipPlan,
} from "../lib/membership-plans";
import { useMe } from "../lib/witers-client";
import { useLanguage } from "../lib/i18n";

// loadStripe() fetches Stripe.js and must only run once per key — the
// publishable key doesn't change mid-session, so a tiny module-level cache
// keeps re-renders (and StrictMode's double-invoke) from loading it twice.
const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();
function getStripePromise(publishableKey: string) {
  let cached = stripePromiseCache.get(publishableKey);
  if (!cached) {
    cached = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, cached);
  }
  return cached;
}

export const Route = createFileRoute("/checkout")({
  validateSearch: z.object({
    plan: z
      .string()
      .optional()
      .transform((v) => (isPlanId(v) ? v : undefined)),
  }),
  head: () => ({
    meta: [
      { title: "Activa tu membresía. WITERS" },
      { name: "description", content: "Activa tu membresía WITERS — Essential, Grow o Scale." },
    ],
  }),
  component: Checkout,
});

// The checkout code remains in this route for the next billing phase, but it
// stays out of the public experience until the matching build variable and
// server-side Worker flag are intentionally enabled.
function selfServiceCheckoutVisible(): boolean {
  return import.meta.env.VITE_SELF_SERVICE_BILLING_ENABLED === "true";
}

function Checkout() {
  const { t, lang } = useLanguage();
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan: planId } = Route.useSearch();
  const [success, setSuccess] = useState<{
    plan: MembershipPlan;
    wasSwitch: boolean;
    amountPaid: number;
  } | null>(null);
  if (!selfServiceCheckoutVisible()) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <h1 className="text-2xl font-extrabold text-wit-ink">
          {t("Acceso gestionado por WITERS", "Access managed by WITERS")}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-wit-gray">
          {t(
            "Durante esta etapa el acceso se habilita directamente desde administración.",
            "During this phase, access is enabled directly by administration.",
          )}
        </p>
        <Link to={me.data?.ok ? "/panel" : "/ingresar"} className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep">
          {me.data?.ok ? t("Ir a mi panel", "Go to my panel") : t("Ingresar", "Log in")}
        </Link>
      </div>
    );
  }
  const plan = getPlan(planId ?? me.data?.membership?.plan);
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const active = me.data?.membership?.status === "active";
  // Already active on this exact plan = nothing to do (blocked below).
  // Active on a *different* plan = an upgrade/downgrade, not a duplicate
  // activation — same price/quota math via currentPriceFor, since
  // activated_at (and therefore the promo window) never resets on a plan
  // change. See /api/checkout's matching guard and /upgrade, the
  // client-facing entry point for this flow.
  const currentPlanId = me.data?.membership?.plan;
  const isSwitch = active && currentPlanId !== plan.id;
  const activatedAt = me.data?.membership?.activated_at ?? null;
  const price = currentPriceFor(plan, activatedAt);
  // A switch charges only the difference from the current plan's rate, not
  // the new plan's full price again — no billing-cycle/renewal-date engine
  // exists here to prorate against, so this is the simplest fair-ish
  // approximation. A downgrade (or same-price swap) costs nothing now;
  // there's no refund path for what was already paid on the pricier plan.
  const oldPrice = isSwitch ? currentPriceFor(getPlan(currentPlanId), activatedAt) : 0;
  const chargeAmount = isSwitch ? Math.max(0, price - oldPrice) : price;
  // Every published price is "más IVA" (/terminos) — this is what's
  // actually charged, and must match /api/stripe/create-payment-intent's
  // math exactly or Stripe verification in /api/checkout rejects it.
  const chargeAmountWithIva = withIva(chargeAmount);

  // Set once /api/checkout confirms the membership actually activated —
  // holds the payment page open on a dedicated success screen instead of
  // jumping straight to /panel, so a real charge always gets a visible
  // "this worked" moment before the page changes under the client.
  // Activates the membership in the DB — called once Stripe has confirmed a
  // real charge (paymentIntentId set) or immediately for a free plan
  // switch/downgrade (omitted). paidAmountWithIva is the amount actually
  // charged (post-discount, from the PaymentIntent the caller already has —
  // never the sticker chargeAmountWithIva computed above, which ignores any
  // discount code applied inside PaymentSection) — shown on the success
  // screen so it matches the real charge on the client's card. Returns an
  // error string for the caller to display, or null on success (the success
  // screen takes over from here).
  async function finalizeCheckout(
    paymentIntentId?: string,
    paidAmountWithIva?: number,
  ): Promise<string | null> {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.id, paymentIntentId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        if (data.error === "no_sesion") {
          navigate({ to: "/ingresar" });
          return null;
        }
        if (data.error === "ya_activa") {
          navigate({ to: "/panel" });
          return null;
        }
        return t(
          "No pudimos activar tu membresía. Intenta de nuevo.",
          "We couldn't activate your membership. Please try again.",
        );
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess({
        plan,
        wasSwitch: isSwitch,
        amountPaid: paidAmountWithIva ?? chargeAmountWithIva,
      });
      return null;
    } catch {
      return t(
        "No pudimos activar tu membresía. Intenta de nuevo.",
        "We couldn't activate your membership. Please try again.",
      );
    }
  }

  if (success) {
    return (
      <CheckoutSuccessScreen
        plan={success.plan}
        wasSwitch={success.wasSwitch}
        amountPaid={success.amountPaid}
        fmt={fmt}
        onContinue={() => navigate({ to: "/panel" })}
      />
    );
  }

  if (me.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!me.data?.ok) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          {t(
            "Para activar tu membresía primero crea tu cuenta o ingresa.",
            "To activate your membership, first create your account or log in.",
          )}
        </p>
        <div className="flex gap-3">
          <Link
            to="/registro"
            className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
          >
            {t("Crear cuenta", "Create account")}
          </Link>
          <Link
            to="/ingresar"
            className="rounded-full border border-wit-ink/15 px-6 py-3 text-sm font-semibold text-wit-ink hover:border-wit-blue"
          >
            {t("Ingresar", "Log in")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wit-page min-h-dvh">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/">
          <WitersLogo />
        </Link>
        <Link to="/panel" className="wit-navlink text-sm font-medium text-wit-ink">
          {t("Mi panel", "My dashboard")}
        </Link>
      </div>

      <main className="mx-auto grid w-full max-w-4xl gap-10 px-5 pb-24 pt-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
            {isSwitch ? (
              lang === "en" ? (
                <>
                  Change your <span className="wit-underline text-wit-blue">plan</span>
                </>
              ) : (
                <>
                  Cambia tu <span className="wit-underline text-wit-blue">plan</span>
                </>
              )
            ) : lang === "en" ? (
              <>
                Activate your <span className="wit-underline text-wit-blue">membership</span>
              </>
            ) : (
              <>
                Activa tu <span className="wit-underline text-wit-blue">membresía</span>
              </>
            )}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-wit-gray">
            {isSwitch ? (
              lang === "en" ? (
                <>
                  You're moving from{" "}
                  <strong className="text-wit-ink">{getPlan(currentPlanId).nombre}</strong> to{" "}
                  <strong className="text-wit-ink">{plan.nombre}</strong>. Your requests used this
                  month and your package requests aren't lost.{" "}
                  {chargeAmount > 0 ? (
                    <>
                      You only pay the difference from what you already covered this month:{" "}
                      <strong className="text-wit-ink">{fmt(chargeAmountWithIva)} MXN</strong> (tax
                      included).
                    </>
                  ) : (
                    "The change has no additional cost this month."
                  )}
                </>
              ) : (
                <>
                  Pasas de <strong className="text-wit-ink">{getPlan(currentPlanId).nombre}</strong>{" "}
                  a <strong className="text-wit-ink">{plan.nombre}</strong>. Tus solicitudes usadas
                  este mes y tus solicitudes de paquetes no se pierden.{" "}
                  {chargeAmount > 0 ? (
                    <>
                      Solo pagas la diferencia con lo que ya cubriste este mes:{" "}
                      <strong className="text-wit-ink">{fmt(chargeAmountWithIva)} MXN</strong> (IVA
                      incluido).
                    </>
                  ) : (
                    "El cambio no tiene costo adicional este mes."
                  )}
                </>
              )
            ) : (
              t(
                "Activa tu suscripción y tu cuenta queda lista para pedir creatividades con IA.",
                "Activate your subscription and your account will be ready to request AI creatives.",
              )
            )}
          </p>

          <div className="mt-8 rounded-3xl bg-wit-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/70">
              WITERS {plan.nombre}
            </p>
            <p className="mt-1 text-sm text-white/80">{plan.tagline}</p>
            <p className="mt-3 font-wit-mono text-5xl font-semibold">{fmt(price)}</p>
            <p className="mt-1 text-sm text-white/75">
              {t("MXN al mes + IVA", "MXN per month + tax")}
            </p>
            {price === plan.precioPromo ? (
              <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                {lang === "en" ? (
                  <>
                    Promo price, valid for your first 3 months. After that:{" "}
                    {fmt(plan.precioRegular)} MXN + tax per month.
                  </>
                ) : (
                  <>
                    Precio de promoción, válido tus primeros 3 meses. Después:{" "}
                    {fmt(plan.precioRegular)} MXN + IVA al mes.
                  </>
                )}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4 text-sm">
              <span className="text-white/70">
                {t("Total con IVA (16%)", "Total with tax (16%)")}
              </span>
              <span className="font-wit-mono font-bold">{fmt(withIva(price))} MXN</span>
            </div>
            <ul className="mt-6 space-y-3">
              {plan.beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-white/90">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="#7da2ff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                  >
                    <path d="M3.5 10.5 8 15l8.5-9.5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          {active && !isSwitch ? (
            <div className="rounded-3xl border border-wit-blue/20 bg-white p-8 text-center">
              <p className="text-lg font-bold text-wit-ink">
                {t("Tu membresía ya está activa.", "Your membership is already active.")}
              </p>
              <Link
                to="/panel"
                className="mt-5 inline-block rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
              >
                {t("Ir a mi panel", "Go to my dashboard")}
              </Link>
            </div>
          ) : (
            <PaymentSection
              plan={plan}
              isSwitch={isSwitch}
              chargeAmount={chargeAmount}
              fmt={fmt}
              onFinalize={finalizeCheckout}
            />
          )}
        </section>
      </main>
    </div>
  );
}

// The one confirmation moment a real charge gets — replaces the old
// behavior of navigating straight to /panel the instant /api/checkout
// returns ok:true, which left a client staring at their card getting
// charged with no visible "this worked" anywhere on screen.
function CheckoutSuccessScreen({
  plan,
  wasSwitch,
  amountPaid,
  fmt,
  onContinue,
}: {
  plan: MembershipPlan;
  wasSwitch: boolean;
  amountPaid: number;
  fmt: (n: number) => string;
  onContinue: () => void;
}) {
  const { t, lang } = useLanguage();
  return (
    <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="wit-float flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-[0_20px_50px_rgba(16,185,129,0.35)]">
        <svg
          width="38"
          height="38"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12.5 9.5 18 20 6" />
        </svg>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-600">
          {t("Pago exitoso", "Payment successful")}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tighter text-wit-ink sm:text-4xl">
          {wasSwitch ? (
            lang === "en" ? (
              <>
                Now you have{" "}
                <span className="wit-underline text-wit-blue">WITERS {plan.nombre}</span>
              </>
            ) : (
              <>
                Ahora tienes{" "}
                <span className="wit-underline text-wit-blue">WITERS {plan.nombre}</span>
              </>
            )
          ) : lang === "en" ? (
            <>
              Welcome to <span className="wit-underline text-wit-blue">WITERS {plan.nombre}</span>
            </>
          ) : (
            <>
              Bienvenida a <span className="wit-underline text-wit-blue">WITERS {plan.nombre}</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-base text-wit-gray">
          {amountPaid > 0
            ? t(
                `Se cobraron ${fmt(amountPaid)} MXN a tu tarjeta. Tu membresía ya está activa.`,
                `${fmt(amountPaid)} MXN was charged to your card. Your membership is now active.`,
              )
            : t(
                "Tu membresía ya está activa, sin costo adicional este mes.",
                "Your membership is now active, with no additional cost this month.",
              )}
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="wit-glow-button mt-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
      >
        {t("Ir a mi panel", "Go to my dashboard")}
      </button>
    </div>
  );
}

type PaymentIntentResponse =
  | { ok: true; free: true; publishableKey: string }
  | {
      ok: true;
      free: false;
      clientSecret: string;
      publishableKey: string;
      chargeAmountWithIva: number;
      discountCode: string | null;
      discountPercent: number | null;
    }
  | { ok: false; error?: string };

const PAYMENT_CARD_CLASS = "rounded-3xl bg-white p-8 shadow-[0_20px_60px_rgba(5,13,40,0.08)]";

const DISCOUNT_ERROR_LABEL: Record<string, { es: string; en: string }> = {
  codigo_invalido: {
    es: "Ese código no existe o ya no está activo.",
    en: "That code doesn't exist or is no longer active.",
  },
  codigo_expirado: { es: "Ese código ya expiró.", en: "That code has already expired." },
  codigo_agotado: {
    es: "Ese código ya alcanzó su límite de usos.",
    en: "That code has already reached its usage limit.",
  },
  monto_muy_bajo: {
    es: "Ese descuento deja el cobro por debajo del mínimo permitido por Stripe ($10 MXN). Prueba con un porcentaje menor.",
    en: "That discount leaves the charge below Stripe's minimum allowed amount ($10 MXN). Try a smaller percentage.",
  },
};

// Creates the PaymentIntent (or detects a free switch) before rendering
// either the Stripe card form or a plain confirm button — Elements needs a
// clientSecret up front, it can't be created after the form mounts. A
// discount code changes the charged amount, so applying/removing one
// creates a brand-new PaymentIntent (and remounts <Elements> with its
// clientSecret) rather than trying to mutate the existing one.
function PaymentSection(props: {
  plan: MembershipPlan;
  isSwitch: boolean;
  chargeAmount: number;
  fmt: (n: number) => string;
  onFinalize: (paymentIntentId?: string, paidAmountWithIva?: number) => Promise<string | null>;
}) {
  const { plan, isSwitch, chargeAmount, fmt, onFinalize } = props;
  const { t } = useLanguage();
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  // Creating a PaymentIntent is a real Stripe API call, not a cheap read —
  // without staleTime/refetchOnWindowFocus this query (like every other
  // useQuery in the app) refetches on every remount AND every time the
  // browser tab regains focus, so a client who just switches tabs and comes
  // back (or hesitates and re-checks the page) silently spawns a brand-new,
  // never-confirmed PaymentIntent each time — which is exactly what filled
  // the Stripe dashboard with "Incompleto" entries. A real card charge is
  // never affected either way (finalizeCheckout only trusts a PaymentIntent
  // that Stripe itself reports as succeeded), this only stops the wasted
  // intent creation. 15 minutes comfortably covers someone filling out card
  // details; a real amount/discount change still creates a fresh intent
  // immediately since those are part of the query key.
  const intentQuery = useQuery({
    queryKey: ["stripe-payment-intent", plan.id, chargeAmount, appliedCode],
    queryFn: async () => {
      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.id, discountCode: appliedCode || undefined }),
      });
      return (await res.json()) as PaymentIntentResponse;
    },
    staleTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const isDiscountError =
    !intentQuery.data?.ok && Boolean(intentQuery.data?.error) && appliedCode !== "";

  // A rejected code falls back to paying full price automatically instead
  // of leaving the whole payment form blocked — the error message stays on
  // screen next to the input so the client knows why.
  useEffect(() => {
    if (isDiscountError && !intentQuery.data?.ok) {
      const label = DISCOUNT_ERROR_LABEL[intentQuery.data?.error ?? ""];
      setCodeError(
        label
          ? t(label.es, label.en)
          : t("No pudimos aplicar ese código.", "We couldn't apply that code."),
      );
      setAppliedCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiscountError, intentQuery.data]);

  if (intentQuery.isLoading || isDiscountError) {
    return (
      <div className={PAYMENT_CARD_CLASS}>
        <div className="h-40 animate-pulse rounded-2xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!intentQuery.data?.ok) {
    return (
      <div className={PAYMENT_CARD_CLASS}>
        <p className="text-sm text-red-600">
          {t(
            "No pudimos preparar el pago. Refresca la página e intenta de nuevo.",
            "We couldn't prepare the payment. Refresh the page and try again.",
          )}
        </p>
      </div>
    );
  }

  const discountBar = (
    <DiscountCodeBar
      codeInput={codeInput}
      onCodeInputChange={setCodeInput}
      appliedCode={appliedCode}
      error={codeError}
      onApply={() => {
        setCodeError(null);
        setAppliedCode(codeInput.trim());
      }}
      onRemove={() => {
        setCodeInput("");
        setAppliedCode("");
        setCodeError(null);
      }}
    />
  );

  if (intentQuery.data.free) {
    return (
      <div className="space-y-4">
        {discountBar}
        <FreeSwitchCard plan={plan} onFinalize={onFinalize} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {discountBar}
      <Elements
        key={intentQuery.data.clientSecret}
        stripe={getStripePromise(intentQuery.data.publishableKey)}
        options={{ clientSecret: intentQuery.data.clientSecret, locale: "es" }}
      >
        <StripeCheckoutForm
          plan={plan}
          isSwitch={isSwitch}
          amountWithIva={intentQuery.data.chargeAmountWithIva}
          discountPercent={intentQuery.data.discountPercent}
          fmt={fmt}
          onFinalize={onFinalize}
        />
      </Elements>
    </div>
  );
}

function DiscountCodeBar({
  codeInput,
  onCodeInputChange,
  appliedCode,
  error,
  onApply,
  onRemove,
}: {
  codeInput: string;
  onCodeInputChange: (v: string) => void;
  appliedCode: string;
  error: string | null;
  onApply: () => void;
  onRemove: () => void;
}) {
  const { t, lang } = useLanguage();
  if (appliedCode) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
        <span className="font-bold text-emerald-700">
          {lang === "en" ? (
            <>
              Code <span className="font-wit-mono">{appliedCode}</span> applied
            </>
          ) : (
            <>
              Código <span className="font-wit-mono">{appliedCode}</span> aplicado
            </>
          )}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-bold text-emerald-700 underline"
        >
          {t("Quitar", "Remove")}
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-wit-ink/10 bg-white p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (codeInput.trim()) onApply();
        }}
        className="flex gap-2"
      >
        <input
          value={codeInput}
          onChange={(e) => onCodeInputChange(e.target.value)}
          placeholder={t("¿Tienes un código de descuento?", "Have a discount code?")}
          className="flex-1 rounded-xl border border-wit-ink/15 px-3.5 py-2.5 text-sm uppercase outline-none focus:border-wit-blue"
        />
        <button
          type="submit"
          disabled={!codeInput.trim()}
          className="shrink-0 rounded-xl bg-wit-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-wit-ink/90 disabled:opacity-40"
        >
          {t("Aplicar", "Apply")}
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

// A same-price switch or downgrade — nothing to charge, so no Stripe form
// at all, just a plain confirm button.
function FreeSwitchCard({
  plan,
  onFinalize,
}: {
  plan: MembershipPlan;
  onFinalize: (paymentIntentId?: string, paidAmountWithIva?: number) => Promise<string | null>;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const err = await onFinalize(undefined, 0);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <div className={PAYMENT_CARD_CLASS}>
      <h2 className="text-xl font-bold text-wit-ink">
        {t("Confirmar cambio de plan", "Confirm plan change")}
      </h2>
      <p className="mt-1 text-xs text-wit-gray">
        {t(
          "Este cambio no tiene costo adicional este mes — no necesitas ingresar datos de pago.",
          "This change has no additional cost this month — you don't need to enter payment details.",
        )}
      </p>
      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-wit-blue px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
      >
        {loading
          ? t("Confirmando...", "Confirming...")
          : t(
              `Cambiar a ${plan.nombre} — sin costo adicional`,
              `Switch to ${plan.nombre} — no additional cost`,
            )}
      </button>
    </div>
  );
}

// Renders inside <Elements>, so useStripe()/useElements() can see the
// clientSecret PaymentSection created above.
function StripeCheckoutForm({
  plan,
  isSwitch,
  amountWithIva,
  discountPercent,
  fmt,
  onFinalize,
}: {
  plan: MembershipPlan;
  isSwitch: boolean;
  amountWithIva: number;
  discountPercent: number | null;
  fmt: (n: number) => string;
  onFinalize: (paymentIntentId?: string, paidAmountWithIva?: number) => Promise<string | null>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "No pudimos procesar el pago. Intenta de nuevo.");
      setLoading(false);
      return;
    }
    if (paymentIntent?.status !== "succeeded") {
      setError("El pago no se completó. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const finalizeError = await onFinalize(paymentIntent.id, amountWithIva);
    if (finalizeError) setError(finalizeError);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className={PAYMENT_CARD_CLASS}>
      <h2 className="text-xl font-bold text-wit-ink">Datos de pago</h2>
      <p className="mt-1 text-xs text-wit-gray">Pago seguro procesado por Stripe.</p>
      {discountPercent ? (
        <p className="mt-1 text-xs font-bold text-emerald-700">
          Descuento de {discountPercent}% aplicado.
        </p>
      ) : null}

      <div className="mt-6">
        <PaymentElement />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !stripe || !elements}
        className="mt-6 w-full rounded-2xl bg-wit-blue px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
      >
        {loading
          ? "Procesando pago..."
          : isSwitch
            ? `Cambiar a ${plan.nombre} — ${fmt(amountWithIva)} MXN`
            : `Pagar ${fmt(amountWithIva)} MXN`}
      </button>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-wit-gray">
        Pago procesado de forma segura por Stripe. Nunca almacenamos los datos de tu tarjeta.
      </p>
    </form>
  );
}
