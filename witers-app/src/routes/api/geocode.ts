import { createFileRoute } from "@tanstack/react-router";

import { geocodeApprox } from "../../lib/geocode.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

// Approximate lat/lon for the pauta wizard's radius-on-a-map preview —
// see geocode.server.ts for why this is separate from Meta's own
// (coordinate-free) location search.
export const Route = createFileRoute("/api/geocode")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim();
        if (q.length < 2) return json({ ok: false, error: "consulta_corta" }, { status: 400 });

        const rawCountry = (url.searchParams.get("country") ?? "").trim().toUpperCase();
        const countryCode = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : "MX";

        const result = await geocodeApprox(q, countryCode);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });
        return json({ ok: true, ...result.data });
      },
    },
  },
});
