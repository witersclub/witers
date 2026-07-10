import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  createSession,
  db,
  json,
  sessionCookie,
  verifyPassword,
} from "../../../lib/witers-auth.server";

const schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(100),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const emailNorm = parsed.data.email.trim().toLowerCase();
        const user = await db()
          .prepare(
            "SELECT id, email, name, role, password_hash, password_salt FROM users WHERE email = ?1",
          )
          .bind(emailNorm)
          .first<{
            id: string;
            email: string;
            name: string;
            role: string;
            password_hash: string;
            password_salt: string;
          }>();

        if (!user) {
          return json({ ok: false, error: "credenciales" }, { status: 401 });
        }
        const valid = await verifyPassword(
          parsed.data.password,
          user.password_salt,
          user.password_hash,
        );
        if (!valid) {
          return json({ ok: false, error: "credenciales" }, { status: 401 });
        }

        const session = await createSession(user.id);
        return json(
          { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
          { headers: { "set-cookie": sessionCookie(session.token, session.maxAge) } },
        );
      },
    },
  },
});

