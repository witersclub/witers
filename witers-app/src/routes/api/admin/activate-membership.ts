import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { currentPriceFor, getPlan, isPlanId } from "../../../lib/membership-plans";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Mirrors the sandbox checkout's activation (api/checkout.ts) — same plan,
// price, and quota — for clients who paid outside the app (bank transfer,
// in person, etc.) and need an admin to flip their membership on by hand.
const schema = z.object({
  userId: z.string().uuid(),
  plan: z.string().refine(isPlanId).default("mensual"),
});

export const Route = createFileRoute("/api/admin/activate-membership")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const plan = getPlan(parsed.data.plan);

        const existing = await db()
          .prepare("SELECT id, status, plan, activated_at FROM memberships WHERE user_id = ?1")
          .bind(parsed.data.userId)
          .first<{ id: string; status: string; plan: string; activated_at: string | null }>();
        const isPlanChange = existing?.status === "active" && existing.plan !== plan.id;
        const alreadyOnPlan = existing?.status === "active" && existing.plan === plan.id;
        const price = currentPriceFor(plan, existing?.activated_at ?? null);

        const membershipId = existing?.id ?? crypto.randomUUID();
        if (existing) {
          // Always resync quotas here, even when the plan isn't changing —
          // a quota column added after this membership was last activated
          // (e.g. carousel_requests_quota) would otherwise stay stuck at
          // its schema default forever, since nothing else re-derives it
          // from the plan. Re-running this is harmless/idempotent.
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
          // Already on this exact plan — quotas are now resynced above,
          // but there's no plan change or payment to record, so stop here
          // rather than logging a duplicate $0 "activation" payment.
          if (alreadyOnPlan) {
            return json({ ok: true, resynced: true });
          }
        } else {
          await db()
            .prepare(
              `INSERT INTO memberships (id, user_id, status, plan, price_mxn, requests_quota, video_requests_quota, carousel_requests_quota, activated_at)
               VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6, ?7, datetime('now'))`,
            )
            .bind(
              membershipId,
              parsed.data.userId,
              plan.id,
              price,
              plan.requestsQuota,
              plan.videoRequestsQuota,
              plan.carouselRequestsQuota,
            )
            .run();
        }

        // Marked distinctly from real checkout payments (provider 'admin',
        // not 'sandbox'/'stripe') so the Pagos tab can tell manual
        // activations apart from ones the client actually paid online for.
        // A plan change is logged the same way but at $0 — the admin isn't
        // charging the client through this action, just recording the switch.
        const paymentId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status)
             VALUES (?1, ?2, ?3, ?4, 'manual', 'admin', ?5, 'paid')`,
          )
          .bind(
            paymentId,
            parsed.data.userId,
            membershipId,
            isPlanChange ? 0 : price,
            `admin:${auth.user.id}`,
          )
          .run();

        return json({ ok: true });
      },
    },
  },
});
