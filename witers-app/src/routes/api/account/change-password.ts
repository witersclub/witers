import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  db,
  getSessionUser,
  hashPassword,
  json,
  verifyPassword,
} from "../../../lib/witers-auth.server";

const schema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100),
});

export const Route = createFileRoute("/api/account/change-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare("SELECT password_hash, password_salt FROM users WHERE id = ?1")
          .bind(user.id)
          .first<{ password_hash: string; password_salt: string }>();
        if (!row) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const valid = await verifyPassword(
          parsed.data.currentPassword,
          row.password_salt,
          row.password_hash,
        );
        if (!valid) {
          return json({ ok: false, error: "contrasena_actual_incorrecta" }, { status: 400 });
        }

        const { hash, salt } = await hashPassword(parsed.data.newPassword);
        await db()
          .prepare("UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3")
          .bind(hash, salt, user.id)
          .run();

        return json({ ok: true });
      },
    },
  },
});
