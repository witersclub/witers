import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, hashPassword, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.union([z.string().min(8).max(100), z.literal("")]),
  role: z.enum(["designer", "admin"]),
});

// Admin-only: edit a designer account's profile in place. Scoped to
// role='designer' on the WHERE clause so this can't be used to tamper
// with an existing admin account.
export const Route = createFileRoute("/api/admin/update-designer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const { userId, role } = parsed.data;
        const emailNorm = parsed.data.email.trim().toLowerCase();
        const nameTrimmed = parsed.data.name.trim();

        const existing = await db()
          .prepare("SELECT id FROM users WHERE id = ?1 AND role = 'designer'")
          .bind(userId)
          .first();
        if (!existing) {
          return json({ ok: false, error: "no_encontrado" }, { status: 404 });
        }

        const emailTaken = await db()
          .prepare("SELECT id FROM users WHERE email = ?1 AND id != ?2")
          .bind(emailNorm, userId)
          .first();
        if (emailTaken) {
          return json({ ok: false, error: "correo_registrado" }, { status: 409 });
        }

        if (parsed.data.password) {
          const { hash, salt } = await hashPassword(parsed.data.password);
          await db()
            .prepare(
              "UPDATE users SET name = ?1, email = ?2, role = ?3, password_hash = ?4, password_salt = ?5 WHERE id = ?6",
            )
            .bind(nameTrimmed, emailNorm, role, hash, salt, userId)
            .run();
        } else {
          await db()
            .prepare("UPDATE users SET name = ?1, email = ?2, role = ?3 WHERE id = ?4")
            .bind(nameTrimmed, emailNorm, role, userId)
            .run();
        }

        return json({ ok: true });
      },
    },
  },
});
