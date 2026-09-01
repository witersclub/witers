import { createFileRoute, Link } from "@tanstack/react-router";

import { WitersLogo } from "../components/witers/brand";
import { MembershipPlanCards } from "../components/witers/membership-cards";
import { useMe } from "../lib/witers-client";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: "Mejora tu plan. WITERS" },
      { name: "description", content: "Compara y cambia entre los planes de membresía WITERS." },
    ],
  }),
  component: Upgrade,
});

function selfServiceCheckoutVisible(): boolean {
  return import.meta.env.VITE_SELF_SERVICE_BILLING_ENABLED === "true";
}

// Deliberately just the 3 fichas — no hero, no testimonios, no FAQ. A
// member who already knows WITERS and wants to see the plans side by side
// shouldn't have to scroll through the homepage's marketing pitch again.
function Upgrade() {
  const me = useMe();
  const { t } = useLanguage();

  if (!selfServiceCheckoutVisible()) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <h1 className="text-2xl font-extrabold text-wit-ink">
          {t("Acceso gestionado por WITERS", "Access managed by WITERS")}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-wit-gray">
          {t(
            "Las activaciones y ajustes de acceso se realizan directamente desde administración.",
            "Access activations and adjustments are handled directly from administration.",
          )}
        </p>
        <Link to={me.data?.ok ? "/panel" : "/ingresar"} className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep">
          {me.data?.ok ? t("Ir a mi panel", "Go to my panel") : t("Ingresar", "Log in")}
        </Link>
      </div>
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
            "Ingresa a tu cuenta para ver y cambiar tu plan.",
            "Sign in to your account to view and change your plan.",
          )}
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Ingresar", "Log in")}
        </Link>
      </div>
    );
  }

  const currentPlanId = me.data.membership?.status === "active" ? me.data.membership.plan : null;

  return (
    <div className="wit-page min-h-dvh bg-wit-navy">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/">
          <WitersLogo />
        </Link>
        <Link to="/panel" className="wit-navlink text-sm font-medium text-white/80">
          {t("Volver a mi panel", "Back to my dashboard")}
        </Link>
      </div>

      <main className="px-5 pb-24 pt-8 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tighter text-white md:text-5xl">
            {currentPlanId
              ? t("Mejora tu plan", "Upgrade your plan")
              : t("Elige tu plan", "Choose your plan")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            {currentPlanId
              ? t(
                  "Más solicitudes, más carruseles y videos, más campañas — cambia cuando quieras, sin perder lo que ya tienes usado este mes.",
                  "More requests, more carousels and videos, more campaigns — switch anytime without losing what you've already used this month.",
                )
              : t(
                  "Elige el nivel de acompañamiento que tu marca necesita.",
                  "Choose the level of support your brand needs.",
                )}
          </p>
        </div>

        <MembershipPlanCards
          ctaFor={(m) => {
            if (m.id === currentPlanId) {
              return { to: "", label: t("Tu plan actual", "Your current plan"), disabled: true };
            }
            return {
              to: "/checkout",
              search: { plan: m.id },
              label: currentPlanId
                ? t(`Cambiar a ${m.nombre}`, `Switch to ${m.nombre}`)
                : t(`Quiero ${m.nombre}`, `I want ${m.nombre}`),
            };
          }}
        />
      </main>
    </div>
  );
}
