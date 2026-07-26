import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { sendMail, verifyEmailEmail } from "../../../lib/mail.server";
import { db, json } from "../../../lib/witers-auth.server";

const schema = z.object({ email: z.string().email().max(120) });

// Always responds ok — whether or not that email has an account, and
// whether or not it's already verified — same anti-enumeration pattern as
// forgot-password.ts. A fresh token is only actually created when there's
// a real, still-unverified account to send it to.
export const Route = createFileRoute("/api/auth/resend-verification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const emailNorm = parsed.data.email.trim().toLowerCase();

        const user = await db()
          .prepare("SELECT id, active, email_verified FROM users WHERE email = ?1")
          .bind(emailNorm)
          .first<{ id: string; active: number; email_verified: number }>();

        if (user?.active && !user.email_verified) {
          const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
          const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
          await db()
            .prepare(
              "INSERT INTO email_verification_tokens (id, user_id, expires_at) VALUES (?1, ?2, ?3)",
            )
            .bind(token, user.id, expiresAt)
            .run();

          const origin = new URL(request.url).origin;
          const verifyUrl = `${origin}/api/auth/verify-email?token=${token}`;
          const { subject, html } = verifyEmailEmail({ verifyUrl });
          await sendMail({ to: emailNorm, subject, html });
        }

        return json({ ok: true });
      },
    },
  },
});
