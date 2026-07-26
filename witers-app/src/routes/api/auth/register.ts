import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { sendMail, verifyEmailEmail } from "../../../lib/mail.server";
import { db, hashPassword, json } from "../../../lib/witers-auth.server";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(100),
  // Only ever comes from /registro?plan=... — carried through the
  // verification link so checkout still opens on the right plan once the
  // client confirms their email, the same way it rides through the
  // Google/Facebook OAuth round trip (see google-auth.server.ts's `state`).
  plan: z.string().max(40).optional(),
});

// No session gets created here anymore — the account exists but stays
// locked out (email_verified = 0, see migration 0030) until the client
// clicks the link this sends. A typo'd email (the actual problem this
// closes) then simply never receives anything, and the client notices
// immediately instead of WITERS finding out weeks later when a delivery
// notification bounces.
export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const { name, email, password, plan } = parsed.data;
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
            "INSERT INTO users (id, email, name, password_hash, password_salt, email_verified) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
          )
          .bind(id, emailNorm, name.trim(), hash, salt)
          .run();

        const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
        await db()
          .prepare(
            "INSERT INTO email_verification_tokens (id, user_id, expires_at) VALUES (?1, ?2, ?3)",
          )
          .bind(token, id, expiresAt)
          .run();

        const origin = new URL(request.url).origin;
        const verifyUrl = `${origin}/api/auth/verify-email?token=${token}${
          plan ? `&plan=${encodeURIComponent(plan)}` : ""
        }`;
        const { subject, html } = verifyEmailEmail({ verifyUrl });
        await sendMail({ to: emailNorm, subject, html });

        return json({ ok: true, email: emailNorm });
      },
    },
  },
});
