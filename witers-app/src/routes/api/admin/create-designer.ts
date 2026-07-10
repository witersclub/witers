import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, hashPassword, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(100),
});

// Admin-only: create a designer account directly (no self-registration —
// the admin sets the password and shares it with the designer themselves).
export const Route = createFileRoute("/api/admin/create-designer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const emailNorm = parsed.data.email.trim().toLowerCase();

        const existing = await db()
          .prepare("SELECT id FROM users WHERE email = ?1")
          .bind(emailNorm)
          .first();
        if (existing) {
          return json({ ok: false, error: "correo_registrado" }, { status: 409 });
        }

        const { hash, salt } = await hashPassword(parsed.data.password);
        const id = crypto.randomUUID();
        await db()
          .prepare(
            "INSERT INTO users (id, email, name, password_hash, password_salt, role) VALUES (?1, ?2, ?3, ?4, ?5, 'designer')",
          )
          .bind(id, emailNorm, parsed.data.name.trim(), hash, salt)
          .run();

        return json({ ok: true, id });
      },
    },
  },
});
