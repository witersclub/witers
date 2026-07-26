import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Admin-only email change — clients can't do this themselves (see
// update-name.ts's comment: it needs re-verification we don't have yet, so
// staff handles it by hand instead), same normalization as
// register.ts/login.ts (trim + lowercase) since email is how a login,
// Google, or Facebook sign-in all match back to this same account.
const schema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().max(120),
});

export const Route = createFileRoute("/api/admin/update-user-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_admin" }, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const emailNorm = parsed.data.email.trim().toLowerCase();

        const existing = await db()
          .prepare("SELECT id FROM users WHERE email = ?1 AND id != ?2")
          .bind(emailNorm, parsed.data.userId)
          .first<{ id: string }>();
        if (existing) {
          return json({ ok: false, error: "correo_en_uso" }, { status: 409 });
        }

        await db()
          .prepare("UPDATE users SET email = ?1 WHERE id = ?2")
          .bind(emailNorm, parsed.data.userId)
          .run();

        return json({ ok: true, email: emailNorm });
      },
    },
  },
});
