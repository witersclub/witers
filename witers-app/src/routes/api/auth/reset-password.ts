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
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export const Route = createFileRoute("/api/auth/reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare(
            `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE id = ?1`,
          )
          .bind(parsed.data.token)
          .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

        if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
          return json({ ok: false, error: "token_invalido" }, { status: 400 });
        }

        const { hash, salt } = await hashPassword(parsed.data.password);
        await db()
          .prepare("UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3")
          .bind(hash, salt, row.user_id)
          .run();
        // Single-use — mark it spent immediately so the same link can't
        // reset the password again later (e.g. from a forwarded email).
        await db()
          .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?1")
          .bind(row.id)
          .run();

        const session = await createSession(row.user_id);
        return json(
          { ok: true },
          { headers: { "set-cookie": sessionCookie(session.token, session.maxAge) } },
        );
      },
    },
  },
});
