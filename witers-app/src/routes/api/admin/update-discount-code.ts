import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Edits an existing code's terms (percent, usage cap, expiry, active flag).
// The code string itself is immutable — changing it would silently break
// any link/flyer already printed with the old one; delete and create a new
// code instead if the code text itself needs to change.
const schema = z.object({
  id: z.string().uuid(),
  discountPercent: z.number().gt(0).max(100).optional(),
  maxUses: z.number().int().min(1).max(100000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/update-discount-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const { id, discountPercent, maxUses, expiresAt, active } = parsed.data;

        const existing = await db()
          .prepare("SELECT id FROM discount_codes WHERE id = ?1")
          .bind(id)
          .first();
        if (!existing) return json({ ok: false, error: "no_encontrado" }, { status: 404 });

        // Only touch fields the caller actually sent — each COALESCE falls
        // back to the current value, so a partial edit (e.g. just the
        // percent) never clobbers max_uses/expires_at/active.
        await db()
          .prepare(
            `UPDATE discount_codes
             SET discount_percent = COALESCE(?2, discount_percent),
                 max_uses = CASE WHEN ?3 THEN ?4 ELSE max_uses END,
                 expires_at = CASE WHEN ?5 THEN ?6 ELSE expires_at END,
                 active = COALESCE(?7, active)
             WHERE id = ?1`,
          )
          .bind(
            id,
            discountPercent ?? null,
            maxUses !== undefined ? 1 : 0,
            maxUses ?? null,
            expiresAt !== undefined ? 1 : 0,
            expiresAt ?? null,
            active === undefined ? null : active ? 1 : 0,
          )
          .run();

        return json({ ok: true });
      },
    },
  },
});
