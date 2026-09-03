import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { interpretAudienceDescription } from "../../lib/meta-audience-interpret.server";
import { searchMetaInterests, searchMetaLocations } from "../../lib/meta-ads-create.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ description: z.string().min(3).max(2000) });

// The "Audiencia" step of Pautar: turns a client's free-text description
// into a suggested audience the client reviews before using it — see
// meta-audience-interpret.server.ts for why interpretation and resolution
// are two separate steps (the AI never invents a Meta id, only search
// keywords a real Meta search then resolves or doesn't).
export const Route = createFileRoute("/api/meta-audience-suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const interpreted = await interpretAudienceDescription(parsed.data.description);
        if (!interpreted.ok) {
          return json({ ok: false, error: interpreted.error }, { status: 502 });
        }
        const { locationQuery, ageMin, ageMax, interestQueries, notes } = interpreted.data;

        const location = locationQuery
          ? await searchMetaLocations(locationQuery, "MX").then((res) =>
              res.ok && res.data[0] ? { key: res.data[0].key, name: res.data[0].name } : null,
            )
          : null;

        // One search per keyword, first match each, deduped by id — a
        // handful of real Meta interests rather than every raw keyword
        // guaranteed to appear (some legitimately have no Meta match).
        const interests: { id: string; name: string }[] = [];
        const seen = new Set<string>();
        for (const query of interestQueries) {
          const res = await searchMetaInterests(query);
          if (!res.ok) continue;
          const match = res.data[0];
          if (match && !seen.has(match.id)) {
            seen.add(match.id);
            interests.push({ id: match.id, name: match.name });
          }
          if (interests.length >= 6) break;
        }

        return json({
          ok: true,
          location,
          ageMin: ageMin ?? null,
          ageMax: ageMax ?? null,
          interests,
          notes,
        });
      },
    },
  },
});
