import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  createSession,
  db,
  hashPassword,
  json,
  sessionCookie,
} from "../../../lib/witers-auth.server";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(100),
});

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const { name, email, password } = parsed.data;
        const emailNorm = email.trim().toLowerCase();

        const existing = await db()
          .prepare("SELECT id FROM users WHERE email = ?1")
          .bind(emailNorm)
          .first();
        if (existing) {
          return json({ ok: false, error: "correo_registrado" }, { status: 409 });
        }

        const { hash, salt } = await hashPassword(password);
        const id = crypto.randomUUID();
        await db()
          .prepare(
            "INSERT INTO users (id, email, name, password_hash, password_salt) VALUES (?1, ?2, ?3, ?4, ?5)",
          )
          .bind(id, emailNorm, name.trim(), hash, salt)
          .run();

        const session = await createSession(id);
        return json(
          { ok: true, user: { id, email: emailNorm, name: name.trim() } },
          { headers: { "set-cookie": sessionCookie(session.token, session.maxAge) } },
        );
      },
    },
  },
});

