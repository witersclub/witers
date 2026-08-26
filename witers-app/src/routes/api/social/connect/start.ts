import { createFileRoute } from "@tanstack/react-router";

import { buildMetaPublishAuthUrl } from "../../../../lib/meta-publish-auth.server";
import { getSessionUser } from "../../../../lib/witers-auth.server";

// Kicks off "connect your Instagram/Facebook" from the Conexiones strip in
// Planificación — unlike /api/auth/facebook/start, this connects a
// publishing channel to an *existing* WITERS session, it never creates one,
// so it requires the client to already be logged in.
export const Route = createFileRoute("/api/social/connect/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) {
          return new Response(null, { status: 302, headers: { location: "/ingresar" } });
        }

        const url = new URL(request.url);
        const nonce = crypto.randomUUID();
        const authUrl = buildMetaPublishAuthUrl(url.origin, nonce);
        if (typeof authUrl !== "string") {
          return new Response("Falta configuración de Meta (META_PUBLISH_APP_ID/SECRET).", {
            status: 500,
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: authUrl,
            "set-cookie": `wit_social_oauth_state=${nonce}; Path=/api/social/connect; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});
