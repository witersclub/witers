import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Mirrors the sandbox checkout's activation (api/checkout.ts) — same plan,
// price, and quota — for clients who paid outside the app (bank transfer,
// in person, etc.) and need an admin to flip their membership on by hand.
const PRICE_MXN = 2999;
const QUOTA = 10;

const schema = z.object({
  userId: z.string().uuid(),
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

        const existing = await db()
          .prepare("SELECT id, status FROM memberships WHERE user_id = ?1")
          .bind(parsed.data.userId)
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
            .bind(membershipId, parsed.data.userId, PRICE_MXN, QUOTA)
            .run();
        }

        // Marked distinctly from real checkout payments (provider 'admin',
        // not 'sandbox'/'stripe') so the Pagos tab can tell manual
        // activations apart from ones the client actually paid online for.
        const paymentId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status)
             VALUES (?1, ?2, ?3, ?4, 'manual', 'admin', ?5, 'paid')`,
          )
          .bind(paymentId, parsed.data.userId, membershipId, PRICE_MXN, `admin:${auth.user.id}`)
          .run();

        return json({ ok: true });
      },
    },
  },
});
