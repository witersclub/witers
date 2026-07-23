import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getPlan, isPlanId } from "../../../lib/membership-plans";
import {
  computeChargeAmount,
  pesosToCentavos,
  stripeClient,
  stripePublishableKey,
} from "../../../lib/stripe.server";
import { db, getSessionUser, json } from "../../../lib/witers-auth.server";

const schema = z.object({ plan: z.string().refine(isPlanId) });

// Creates the Stripe PaymentIntent a checkout submission confirms against.
// Recomputes the charge amount server-side from the DB (never trusts a
// client-sent price) — this is the one source of truth /api/checkout later
// verifies its PaymentIntent against before activating anything.
export const Route = createFileRoute("/api/stripe/create-payment-intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        if (!publishableKey)
          return json({ ok: false, error: "stripe_no_configurado" }, { status: 500 });

        // A same-price switch or a downgrade charges nothing — nothing to
        // confirm with Stripe, /api/checkout activates it directly.
        if (chargeAmount <= 0) {
          return json({ ok: true, free: true, publishableKey });
        }

        const intent = await stripeClient().paymentIntents.create({
          amount: pesosToCentavos(chargeAmountWithIva),
          currency: "mxn",
          receipt_email: user.email,
          metadata: {
            userId: user.id,
            plan: plan.id,
            chargeAmountWithIvaMxn: String(chargeAmountWithIva),
          },
          automatic_payment_methods: { enabled: true },
        });

        return json({
          ok: true,
          free: false,
          clientSecret: intent.client_secret,
          publishableKey,
          chargeAmountWithIva,
        });
      },
    },
  },
});
