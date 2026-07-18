import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Manual top-up for a client who ran out of solicitudes — same mechanism as
// a purchased image pack (bonus_requests_quota, see /api/purchase-pack),
// just granted for free by an admin instead of paid for. Marked distinctly
// from a real pack purchase (provider_ref 'grant:' not 'card-') so the
// Pagos tab can tell the two apart.
const schema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(1).max(100),
});

export const Route = createFileRoute("/api/admin/grant-requests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const membership = await db()
          .prepare("SELECT id, status FROM memberships WHERE user_id = ?1")
          .bind(parsed.data.userId)
          .first<{ id: string; status: string }>();
        if (!membership || membership.status !== "active") {
          return json({ ok: false, error: "sin_membresia" }, { status: 403 });
        }

        await db()
          .prepare(
            "UPDATE memberships SET bonus_requests_quota = bonus_requests_quota + ?2 WHERE id = ?1",
          )
          .bind(membership.id, parsed.data.amount)
          .run();

        const paymentId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status, pack_id, pack_images)
             VALUES (?1, ?2, ?3, 0, 'manual', 'admin', ?4, 'paid', 'admin_grant', ?5)`,
          )
          .bind(
            paymentId,
            parsed.data.userId,
            membership.id,
            `grant:${auth.user.id}`,
            parsed.data.amount,
          )
          .run();

        return json({ ok: true, bonusAdded: parsed.data.amount });
      },
    },
  },
});
