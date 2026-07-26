import { createFileRoute } from "@tanstack/react-router";

import { buildFacebookAuthUrl } from "../../../../lib/facebook-auth.server";
import { isPlanId } from "../../../../lib/membership-plans";

// Kicks off "Sign in with Facebook" — a plain browser redirect (not a
// fetch), so both /registro and /ingresar can point straight at this URL
// with an <a href>. `plan` (only present coming from /registro?plan=...)
// rides along inside `state` so it survives the round trip to Facebook and
// back, the same way registro.tsx passes it to /checkout after a normal
// signup.
export const Route = createFileRoute("/api/auth/facebook/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const planParam = url.searchParams.get("plan");
        const plan = isPlanId(planParam) ? planParam : undefined;

        const nonce = crypto.randomUUID();
        const state = btoa(JSON.stringify({ nonce, plan }));
        const authUrl = buildFacebookAuthUrl(url.origin, state);
        if (typeof authUrl !== "string") {
          return new Response("Falta configuración de Facebook (FACEBOOK_APP_ID/SECRET).", {
            status: 500,
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: authUrl,
            "set-cookie": `wit_oauth_state=${nonce}; Path=/api/auth/facebook; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});
