import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { applyDiscount, validateDiscountCode } from "../../../lib/discount-codes.server";
import { getPlan, isPlanId } from "../../../lib/membership-plans";
import {
  computeChargeAmount,
  pesosToCentavos,
  STRIPE_MIN_MXN,
  stripeClient,
  stripePublishableKey,
} from "../../../lib/stripe.server";
import { db, getSessionUser, json } from "../../../lib/witers-auth.server";

const schema = z.object({
  plan: z.string().refine(isPlanId),
  discountCode: z.string().max(30).optional(),
});

async function handlePost(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
  }
  const plan = getPlan(parsed.data.plan);

  const existing = await db()
    .prepare("SELECT status, plan, activated_at FROM memberships WHERE user_id = ?1")
    .bind(user.id)
    .first<{ status: string; plan: string; activated_at: string | null }>();
  if (existing?.status === "active" && existing.plan === plan.id) {
    return json({ ok: false, error: "ya_activa" }, { status: 409 });
  }

  const { chargeAmount, chargeAmountWithIva } = computeChargeAmount(plan, existing);
  const publishableKey = stripePublishableKey();
  if (!publishableKey) return json({ ok: false, error: "stripe_no_configurado" }, { status: 500 });

  // A same-price switch or a downgrade charges nothing — nothing to
  // confirm with Stripe, /api/checkout activates it directly.
  if (chargeAmount <= 0) {
    return json({ ok: true, free: true, publishableKey });
  }

  // Discount is optional and, if given, must be valid — an invalid/
  // expired/exhausted code fails the whole request rather than
  // silently charging full price, so the client always knows why.
  let discountCode: string | null = null;
  let discountPercent: number | null = null;
  let finalAmount = chargeAmountWithIva;
  if (parsed.data.discountCode) {
    const check = await validateDiscountCode(parsed.data.discountCode);
    if (!check.ok) return json({ ok: false, error: check.error }, { status: 400 });
    discountCode = check.row.code;
    discountPercent = check.row.discount_percent;
    finalAmount = applyDiscount(chargeAmountWithIva, discountPercent);
  }

  // A big enough discount (up to 100%) can bring the charge to $0 —
  // same "nothing to confirm with Stripe" path as a free plan switch.
  if (finalAmount <= 0) {
    return json({ ok: true, free: true, publishableKey });
  }
  // Between $0 and Stripe's $10 MXN floor there's nothing valid to charge —
  // reject with a clear reason instead of letting Stripe's API call fail.
  if (finalAmount < STRIPE_MIN_MXN) {
    return json({ ok: false, error: "monto_muy_bajo" }, { status: 400 });
  }

  const intent = await stripeClient().paymentIntents.create({
    amount: pesosToCentavos(finalAmount),
    currency: "mxn",
    receipt_email: user.email,
    metadata: {
      userId: user.id,
      plan: plan.id,
      chargeAmountWithIvaMxn: String(finalAmount),
      ...(discountCode ? { discountCode, discountPercent: String(discountPercent) } : {}),
    },
    automatic_payment_methods: { enabled: true },
  });

  return json({
    ok: true,
    free: false,
    clientSecret: intent.client_secret,
    publishableKey,
    chargeAmountWithIva: finalAmount,
    discountCode,
    discountPercent,
  });
}

// Creates the Stripe PaymentIntent a checkout submission confirms against.
// Recomputes the charge amount server-side from the DB (never trusts a
// client-sent price) — this is the one source of truth /api/checkout later
// verifies its PaymentIntent against before activating anything.
export const Route = createFileRoute("/api/stripe/create-payment-intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handlePost(request);
        } catch (err) {
          // Never let an exception (Stripe SDK included) escape uncaught —
          // Workers can turn an unhandled rejection from deep inside a
          // dependency into a confusing runtime-level error instead of a
          // normal HTTP response.
          console.error("create-payment-intent failed:", err);
          return json({ ok: false, error: "error_interno" }, { status: 500 });
        }
      },
    },
  },
});
