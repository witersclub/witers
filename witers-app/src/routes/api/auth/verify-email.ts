import { createFileRoute } from "@tanstack/react-router";

import { createSession, db, sessionCookie } from "../../../lib/witers-auth.server";

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

// The client lands here straight from the link in verifyEmailEmail — a
// plain browser navigation (GET), not a fetch, so this both marks the
// account verified and signs them in in one step instead of making them
// log in again right after confirming.
export const Route = createFileRoute("/api/auth/verify-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return redirect("/ingresar?error=token_invalido");

        const row = await db()
          .prepare(
            `SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE id = ?1`,
          )
          .bind(token)
          .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

        if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
          return redirect("/ingresar?error=token_invalido");
        }

        await db()
          .prepare("UPDATE users SET email_verified = 1 WHERE id = ?1")
          .bind(row.user_id)
          .run();
        // Single-use — mark it spent immediately so a forwarded/reused link
        // can't do anything once the account is already verified.
        await db()
          .prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?1")
          .bind(row.id)
          .run();

        const session = await createSession(row.user_id);
        const dest = "/panel";
        return new Response(null, {
          status: 302,
          headers: {
            location: dest,
            "set-cookie": sessionCookie(session.token, session.maxAge),
          },
        });
      },
    },
  },
});
