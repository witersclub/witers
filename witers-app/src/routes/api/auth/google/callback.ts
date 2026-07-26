import { createFileRoute } from "@tanstack/react-router";

import { exchangeCodeForIdentity } from "../../../../lib/google-auth.server";
import { createSession, db, sessionCookie } from "../../../../lib/witers-auth.server";

const CLEAR_STATE_COOKIE =
  "wit_oauth_state=; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function redirect(location: string, extraSetCookie?: string): Response {
  const headers = new Headers({ location });
  headers.append("set-cookie", CLEAR_STATE_COOKIE);
  if (extraSetCookie) headers.append("set-cookie", extraSetCookie);
  return new Response(null, { status: 302, headers });
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

// Google lands the browser back here after consent — matches the client's
// existing WITERS account by email (creating one if there isn't one yet),
// same as a normal email/password signup, then signs them in the same way
// /api/auth/login does.
export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state");
        if (!code || !stateParam) {
          return redirect("/ingresar?error=google");
        }

        let plan: string | undefined;
        try {
          const parsed = JSON.parse(atob(stateParam)) as { nonce?: string; plan?: string };
          const cookieNonce = readCookie(request, "wit_oauth_state");
          if (!parsed.nonce || !cookieNonce || parsed.nonce !== cookieNonce) {
            return redirect("/ingresar?error=google");
          }
          plan = parsed.plan;
        } catch {
          return redirect("/ingresar?error=google");
        }

        const identity = await exchangeCodeForIdentity(code, url.origin);
        if (!identity.ok) {
          return redirect("/ingresar?error=google");
        }
        const { email, name, sub } = identity.data;

        const existing = await db()
          .prepare("SELECT id, role, active FROM users WHERE email = ?1")
          .bind(email)
          .first<{ id: string; role: string; active: number }>();

        if (existing) {
          if (!existing.active) {
            return redirect("/ingresar?error=cuenta_dada_de_baja");
          }
          // Keep google_id current even for an account that originally
          // signed up with a password — the same account works either way
          // from now on. Also marks the email verified: Google itself just
          // proved they own this inbox, so an account still blocked from
          // the password path (see migration 0030) is unblocked right here
          // instead of making them go dig up the confirmation email too.
          await db()
            .prepare("UPDATE users SET google_id = ?1, email_verified = 1 WHERE id = ?2")
            .bind(sub, existing.id)
            .run();
          const session = await createSession(existing.id);
          const dest =
            existing.role === "designer"
              ? "/witer"
              : existing.role === "admin"
                ? "/admin"
                : "/panel";
          return redirect(dest, sessionCookie(session.token, session.maxAge));
        }

        // New account — no password to set, so password_hash/salt get a
        // random value that can never be derived from any real password
        // (this account only ever signs in through Google from here on).
        const randomHash = crypto.randomUUID() + crypto.randomUUID();
        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO users (id, email, name, password_hash, password_salt, google_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(id, email, name, randomHash, randomHash, sub)
          .run();

        const session = await createSession(id);
        const dest = plan ? `/checkout?plan=${encodeURIComponent(plan)}` : "/checkout";
        return redirect(dest, sessionCookie(session.token, session.maxAge));
      },
    },
  },
});
