import { createFileRoute } from "@tanstack/react-router";

import { suggestMetaInterests } from "../../lib/meta-ads.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

// "Sugerencias" for the segmentación step — given the interests a client
// already picked, ask Meta for related ones so they don't have to guess
// synonyms themselves (the same behavior real Ads Manager shows).
export const Route = createFileRoute("/api/meta-interest-suggestions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const url = new URL(request.url);
        const names = (url.searchParams.get("interests") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10);
        if (names.length === 0) return json({ ok: true, results: [] });

        const result = await suggestMetaInterests(names);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });
        return json({ ok: true, results: result.data });
      },
    },
  },
});
