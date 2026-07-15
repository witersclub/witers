import { createFileRoute } from "@tanstack/react-router";

import { searchMetaInterests } from "../../lib/meta-ads.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

// Interest autocomplete for the Pauta interactiva's "segmentación" field —
// proxies Meta's own interest search so the client picks real, valid
// interest IDs instead of typing free text Meta wouldn't understand.
export const Route = createFileRoute("/api/meta-interest-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim();
        if (q.length < 2) return json({ ok: true, results: [] });

        const result = await searchMetaInterests(q);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });
        return json({ ok: true, results: result.data });
      },
    },
  },
});
