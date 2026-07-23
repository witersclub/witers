import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { applyDiscount, recordDiscountCodeUse } from "../../lib/discount-codes.server";
import { getPlan, isPlanId } from "../../lib/membership-plans";
import { computeChargeAmount, pesosToCentavos, stripeClient } from "../../lib/stripe.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  plan: z.string().refine(isPlanId),
  // Present only when the charge was > $0 — a Stripe PaymentIntent this
  // route verifies actually succeeded before touching the DB. Omitted for
  // a free plan switch/downgrade, where there's nothing to charge.
  paymentIntentId: z.string().optional(),
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
    .prepare("SELECT id, status, plan, activated_at FROM memberships WHERE user_id = ?1")
    .bind(user.id)
    .first<{ id: string; status: string; plan: string; activated_at: string | null }>();
  // Active on this exact plan already — nothing to do. Active on a
  // *different* plan is a legitimate upgrade/downgrade, not a
  // duplicate activation, so it falls through to the same UPDATE
  // below (see /upgrade for the client-facing entry point).
  if (existing?.status === "active" && existing.plan === plan.id) {
    return json({ ok: false, error: "ya_activa" }, { status: 409 });
  }

  // Recomputed independently from the DB — never trust a client-sent
  // price. Must match exactly what /api/stripe/create-payment-intent
  // charged (IVA included), or the PaymentIntent verification below
  // rejects it.
  const { price, chargeAmount, chargeAmountWithIva } = computeChargeAmount(plan, existing);
  let paymentIntentId: string | null = null;
  // Set only if the PaymentIntent's own metadata says a discount code
  // was applied when it was created — that metadata is server-set at
  // creation time and never touched by the client, so it's as trusted
  // as intent.metadata.userId/plan below.
  let discountCode: string | null = null;
  let discountPercent: number | null = null;
  let paidAmount = chargeAmount > 0 ? chargeAmountWithIva : chargeAmount;

  if (chargeAmount > 0) {
    paymentIntentId = parsed.data.paymentIntentId ?? null;
    if (!paymentIntentId) {
      return json({ ok: false, error: "pago_requerido" }, { status: 400 });
    }
    // provider_ref is only ever written below after a verified charge,
    // so a prior 'paid' row for this same PaymentIntent means it was
    // already used to activate a membership — reject the replay.
    const alreadyUsed = await db()
      .prepare("SELECT id FROM payments WHERE provider_ref = ?1 AND status = 'paid'")
      .bind(paymentIntentId)
      .first();
    if (alreadyUsed) {
      return json({ ok: false, error: "pago_ya_usado" }, { status: 409 });
    }

    const intent = await stripeClient().paymentIntents.retrieve(paymentIntentId);
    discountCode = intent.metadata.discountCode ?? null;
    discountPercent = intent.metadata.discountPercent
      ? Number(intent.metadata.discountPercent)
      : null;
    const expectedAmount =
      discountCode && discountPercent !== null
        ? applyDiscount(chargeAmountWithIva, discountPercent)
        : chargeAmountWithIva;

    const matches =
      intent.status === "succeeded" &&
      intent.metadata.userId === user.id &&
      intent.metadata.plan === plan.id &&
      intent.amount === pesosToCentavos(expectedAmount);
    if (!matches) {
      return json({ ok: false, error: "pago_invalido" }, { status: 400 });
    }
    paidAmount = expectedAmount;
  }

  const membershipId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await db()
      .prepare(
        `UPDATE memberships
         SET status = 'active', plan = ?2, price_mxn = ?3, requests_quota = ?4, video_requests_quota = ?5,
             carousel_requests_quota = ?6, activated_at = COALESCE(activated_at, datetime('now'))
         WHERE id = ?1`,
      )
      .bind(
        membershipId,
        plan.id,
        price,
        plan.requestsQuota,
        plan.videoRequestsQuota,
        plan.carouselRequestsQuota,
      )
      .run();
  } else {
    await db()
      .prepare(
        `INSERT INTO memberships (id, user_id, status, plan, price_mxn, requests_quota, video_requests_quota, carousel_requests_quota, activated_at)
         VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6, ?7, datetime('now'))`,
      )
      .bind(
        membershipId,
        user.id,
        plan.id,
        price,
        plan.requestsQuota,
        plan.videoRequestsQuota,
        plan.carouselRequestsQuota,
      )
      .run();
  }

  // amount_mxn records what was actually charged (IVA and any
  // discount already applied) — a free switch charges $0 either way.
  const paymentId = crypto.randomUUID();
  await db()
    .prepare(
      `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status, discount_code, discount_percent)
       VALUES (?1, ?2, ?3, ?4, 'card', 'stripe', ?5, 'paid', ?6, ?7)`,
    )
    .bind(
      paymentId,
      user.id,
      membershipId,
      paidAmount,
      paymentIntentId,
      discountCode,
      discountPercent,
    )
    .run();

  if (discountCode) await recordDiscountCodeUse(discountCode);

  return json({ ok: true, membershipId, paymentId, chargeAmount: paidAmount });
}

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handlePost(request);
        } catch (err) {
          console.error("checkout failed:", err);
          return json({ ok: false, error: "error_interno" }, { status: 500 });
        }
      },
    },
  },
});
