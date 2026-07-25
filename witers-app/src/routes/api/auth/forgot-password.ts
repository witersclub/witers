import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { passwordResetEmail, sendMail } from "../../../lib/mail.server";
import { db, json } from "../../../lib/witers-auth.server";

const schema = z.object({ email: z.string().email().max(120) });

// Always responds ok — whether or not that email has an account — so this
// can't be used to fish for which emails are registered with WITERS. The
// reset link itself does the real work; a token gets created only when the
// account genuinely exists.
export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const emailNorm = parsed.data.email.trim().toLowerCase();

        const user = await db()
          .prepare("SELECT id, active FROM users WHERE email = ?1")
          .bind(emailNorm)
          .first<{ id: string; active: number }>();

        if (user?.active) {
          const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
          const expiresAt = new Date(Date.now() + 3600_000).toISOString();
          await db()
            .prepare(
              "INSERT INTO password_reset_tokens (id, user_id, expires_at) VALUES (?1, ?2, ?3)",
            )
            .bind(token, user.id, expiresAt)
            .run();

          const origin = new URL(request.url).origin;
          const resetUrl = `${origin}/restablecer-contrasena?token=${token}`;
          const { subject, html } = passwordResetEmail({ resetUrl });
          await sendMail({ to: emailNorm, subject, html });
        }

        return json({ ok: true });
      },
    },
  },
});
