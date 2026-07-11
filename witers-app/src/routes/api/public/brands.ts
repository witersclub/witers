import { createFileRoute } from "@tanstack/react-router";

import { db, json } from "../../../lib/witers-auth.server";

// Public, unauthenticated: real client brand names + logos, sourced from the
// company_name/logo_key clients themselves supplied when submitting a
// request. Only ever surfaces brands with a finalized ("cerrada") request —
// same trust boundary as /api/public/showcase. One row per distinct brand
// (a client may have several requests; only the latest with a logo counts).
// logo_public defaults to 1 but lets staff hide a specific logo from this
// public wall (e.g. a client uploaded a photo instead of a clean logotype)
// without touching the underlying request.
export const Route = createFileRoute("/api/public/brands")({
  server: {
    handlers: {
      GET: async () => {
        const baseQuery = `SELECT r.company_name AS company_name, r.logo_key AS logo_key, MAX(r.created_at) AS created_at
             FROM design_requests r
             WHERE r.status = 'cerrada'
               AND r.logo_key IS NOT NULL
               AND r.company_name IS NOT NULL
               AND trim(r.company_name) != ''
               {LOGO_PUBLIC_FILTER}
             GROUP BY lower(trim(r.company_name))
             ORDER BY created_at DESC
             LIMIT 16`;

        let rows;
        try {
          // Preferred query: respects the hide-a-logo toggle.
          rows = await db()
            .prepare(baseQuery.replace("{LOGO_PUBLIC_FILTER}", "AND r.logo_public = 1"))
            .all();
        } catch {
          // The logo_public column migration (0010) hasn't been applied to
          // this database yet — fall back to the pre-migration query rather
          // than let the whole brand wall go dark. Once the migration runs,
          // the query above succeeds and the hide toggle starts working.
          rows = await db().prepare(baseQuery.replace("{LOGO_PUBLIC_FILTER}", "")).all();
        }

        return json({ ok: true, brands: rows.results ?? [] });
      },
    },
  },
});
