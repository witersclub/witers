import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { normalizeCode } from "../../../lib/discount-codes.server";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  code: z.string().min(3).max(30),
  discountPercent: z.number().gt(0).max(100),
  maxUses: z.number().int().min(1).max(100000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const Route = createFileRoute("/api/admin/create-discount-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const code = normalizeCode(parsed.data.code);
        if (!code) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const existing = await db()
          .prepare("SELECT id FROM discount_codes WHERE code = ?1")
          .bind(code)
          .first();
        if (existing) return json({ ok: false, error: "codigo_ya_existe" }, { status: 409 });

        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO discount_codes (id, code, discount_percent, max_uses, expires_at, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            id,
            code,
            parsed.data.discountPercent,
            parsed.data.maxUses ?? null,
            parsed.data.expiresAt ?? null,
            auth.user.id,
          )
          .run();

        return json({ ok: true, id, code });
      },
    },
  },
});
