import { createFileRoute } from "@tanstack/react-router";

import { exchangeCodeForInstagramIdentity } from "../../../../../lib/instagram-login-auth.server";
import { upsertSocialConnection } from "../../../../../lib/social-connections.server";
import { encryptToken } from "../../../../../lib/token-crypto.server";
import { getSessionUser } from "../../../../../lib/witers-auth.server";

const CLEAR_STATE_COOKIE =
  "wit_ig_oauth_state=; Path=/api/social/connect/instagram; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

function redirect(location: string): Response {
  const headers = new Headers({ location });
  headers.append("set-cookie", CLEAR_STATE_COOKIE);
  return new Response(null, { status: 302, headers });
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

// Instagram lands the browser back here after the client authorizes the
// INSTAGRAM_APP. No Facebook Page involved — this account's own access
// token is what publishes directly to it later.
export const Route = createFileRoute("/api/social/connect/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return redirect("/ingresar");

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieNonce = readCookie(request, "wit_ig_oauth_state");
        if (!code || !state || !cookieNonce || state !== cookieNonce) {
          return redirect("/panel?social_error=1");
        }

        const identity = await exchangeCodeForInstagramIdentity(code, url.origin);
        if (!identity.ok) return redirect("/panel?social_error=1");

        const { ciphertext, iv } = await encryptToken(identity.data.accessToken);
        await upsertSocialConnection(
          user.id,
          "instagram",
          identity.data.igUserId,
          identity.data.username,
          null,
          ciphertext,
          iv,
        );

        return redirect("/panel?social_connected=1");
      },
    },
  },
});
