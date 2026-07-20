import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { currentPriceFor, getPlan, isPlanId } from "../../lib/membership-plans";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  // Card fields are accepted for UX completeness but NEVER stored. When a real
  // payment provider (Stripe / Mercado Pago) is wired via website secrets, this
  // route exchanges them for a provider token instead.
  cardName: z.string().min(2).max(80),
  cardLast4: z.string().regex(/^\d{4}$/),
  plan: z.string().refine(isPlanId),
});

export const Route = createFileRoute("/api/checkout")({
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

        // A returning member keeps their original activated_at (so the 3-month
        // promo window is anchored to when they first subscribed, not reset on
        // every reactivation); a brand-new member has none yet, so they always
        // get the promo price.
        const price = currentPriceFor(plan, existing?.activated_at ?? null);

        // A plan switch charges only the difference from what they're already
        // paying this month — not the new plan's full price again — since
        // there's no real subscription/billing-cycle engine here to prorate
        // against (no stored renewal date). A downgrade (or same-price swap)
        // charges nothing; there's no refund path for the difference already
        // paid on the old plan, so it just takes effect for free.
        let chargeAmount = price;
        if (existing?.status === "active" && existing.plan !== plan.id) {
          const oldPrice = currentPriceFor(getPlan(existing.plan), existing.activated_at);
          chargeAmount = Math.max(0, price - oldPrice);
        }

        const membershipId = existing?.id ?? crypto.randomUUID();
        if (existing) {
          await db()
            .prepare(
              `UPDATE memberships
               SET status = 'active', plan = ?2, price_mxn = ?3, requests_quota = ?4, video_requests_quota = ?5,
                   activated_at = COALESCE(activated_at, datetime('now'))
               WHERE id = ?1`,
            )
            .bind(membershipId, plan.id, price, plan.requestsQuota, plan.videoRequestsQuota)
            .run();
        } else {
          await db()
            .prepare(
              `INSERT INTO memberships (id, user_id, status, plan, price_mxn, requests_quota, video_requests_quota, activated_at)
               VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6, datetime('now'))`,
            )
            .bind(
              membershipId,
              user.id,
              plan.id,
              price,
              plan.requestsQuota,
              plan.videoRequestsQuota,
            )
            .run();
        }

        const paymentId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status)
             VALUES (?1, ?2, ?3, ?4, 'card', 'sandbox', ?5, 'paid')`,
          )
          .bind(paymentId, user.id, membershipId, chargeAmount, `card-${parsed.data.cardLast4}`)
          .run();

        return json({ ok: true, membershipId, paymentId, chargeAmount });
      },
    },
  },
});
