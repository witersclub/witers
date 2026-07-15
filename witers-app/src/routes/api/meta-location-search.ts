import { createFileRoute } from "@tanstack/react-router";

import { searchMetaLocations } from "../../lib/meta-ads.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

// Location autocomplete for the Pauta interactiva's "ubicación" field —
// proxies Meta's own city/neighborhood/zip search (no external geocoding,
// no street addresses) so the client picks a real Meta-recognized place
// and we attach a radius to it at campaign creation time.
export const Route = createFileRoute("/api/meta-location-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim();
        if (q.length < 2) return json({ ok: true, results: [] });

        const result = await searchMetaLocations(q);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });
        return json({ ok: true, results: result.data });
      },
    },
  },
});
