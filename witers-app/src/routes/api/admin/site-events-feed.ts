import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

export type SiteEventRow = {
  id: string;
  type: string;
  path: string;
  label: string | null;
  country: string | null;
  visitor_id: string | null;
  user_name: string | null;
  user_role: string | null;
  created_at: string;
};

const PAGE_SIZE = 40;
const VALID_TYPES = new Set(["page_view", "whatsapp_click", "cta_click"]);

// Raw, row-per-event feed for the admin "Actividad" tab — the individual
// "who did what, where, when" log behind the aggregate cards above it in
// Indicadores. Reuses site_events (see 0036/0038 migrations) instead of a
// new table; joins users for a display name since site_events only stores
// user_id. Offset pagination is fine at this app's traffic volume — no
// need for keyset pagination over a table this small.
export const Route = createFileRoute("/api/admin/site-events-feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const url = new URL(request.url);
        const typeParam = url.searchParams.get("type");
        const type = typeParam && VALID_TYPES.has(typeParam) ? typeParam : null;
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

        const where = type ? "WHERE e.type = ?1" : "";
        const bindings = type ? [type, PAGE_SIZE + 1, offset] : [PAGE_SIZE + 1, offset];

        const rows = await db()
          .prepare(
            `SELECT e.id, e.type, e.path, e.label, e.country, e.visitor_id,
               u.name AS user_name, u.role AS user_role, e.created_at
             FROM site_events e
             LEFT JOIN users u ON u.id = e.user_id
             ${where}
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT ?${type ? "2" : "1"} OFFSET ?${type ? "3" : "2"}`,
          )
          .bind(...bindings)
          .all<SiteEventRow>();

        const results = rows.results ?? [];
        const hasMore = results.length > PAGE_SIZE;

        return json({
          ok: true,
          events: results.slice(0, PAGE_SIZE),
          hasMore,
        });
      },
    },
  },
});
