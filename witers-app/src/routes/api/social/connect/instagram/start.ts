import { createFileRoute } from "@tanstack/react-router";

import { buildInstagramAuthUrl } from "../../../../../lib/instagram-login-auth.server";
import { getSessionUser } from "../../../../../lib/witers-auth.server";

// "Conectar Instagram" directo — el cliente entra con su propia cuenta de
// Instagram, sin pasar por Facebook ni necesitar una Página vinculada.
// Requiere sesión de WITERS ya iniciada, igual que el connect de Facebook.
export const Route = createFileRoute("/api/social/connect/instagram/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) {
          return new Response(null, { status: 302, headers: { location: "/ingresar" } });
        }

        const url = new URL(request.url);
        const nonce = crypto.randomUUID();
        const authUrl = buildInstagramAuthUrl(url.origin, nonce);
        if (typeof authUrl !== "string") {
          return new Response("Falta configuración de Instagram (INSTAGRAM_APP_ID/SECRET).", {
            status: 500,
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: authUrl,
            "set-cookie": `wit_ig_oauth_state=${nonce}; Path=/api/social/connect/instagram; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});
