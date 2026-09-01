import { createFileRoute } from "@tanstack/react-router";
import { buildMetaAdAccountAuthUrl } from "../../../../lib/meta-ad-account-auth.server";
import { getSessionUser } from "../../../../lib/witers-auth.server";

export const Route = createFileRoute("/api/meta/ad-account/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return new Response(null, { status: 302, headers: { location: "/ingresar" } });
        const origin = new URL(request.url).origin;
        const state = crypto.randomUUID();
        const location = buildMetaAdAccountAuthUrl(origin, state);
        if (!location) return new Response("Falta configuración de Meta", { status: 500 });
        return new Response(null, {
          status: 302,
          headers: {
            location,
            "set-cookie": `wit_meta_ads_state=${state}; Path=/api/meta/ad-account; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});
