import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const PRICE_MXN = 5999;
const QUOTA = 20;

const schema = z.object({
  // Card fields are accepted for UX completeness but NEVER stored. When a real
  // payment provider (Stripe / Mercado Pago) is wired via website secrets, this
  // route exchanges them for a provider token instead.
  cardName: z.string().min(2).max(80),
  cardLast4: z.string().regex(/^\d{4}$/),
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

        const existing = await db()
          .prepare("SELECT id, status FROM memberships WHERE user_id = ?1")
          .bind(user.id)
          .first<{ id: string; status: string }>();
        if (existing?.status === "active") {
          return json({ ok: false, error: "ya_activa" }, { status: 409 });
        }

        const membershipId = existing?.id ?? crypto.randomUUID();
        if (existing) {
          await db()
            .prepare(
              "UPDATE memberships SET status = 'active', activated_at = datetime('now') WHERE id = ?1",
            )
            .bind(membershipId)
            .run();
        } else {
          await db()
            .prepare(
              `INSERT INTO memberships (id, user_id, status, price_mxn, requests_quota, activated_at)
               VALUES (?1, ?2, 'active', ?3, ?4, datetime('now'))`,
            )
            .bind(membershipId, user.id, PRICE_MXN, QUOTA)
            .run();
        }

        const paymentId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status)
             VALUES (?1, ?2, ?3, ?4, 'card', 'sandbox', ?5, 'paid')`,
          )
          .bind(paymentId, user.id, membershipId, PRICE_MXN, `card-${parsed.data.cardLast4}`)
          .run();

        return json({ ok: true, membershipId, paymentId });
      },
    },
  },
});
