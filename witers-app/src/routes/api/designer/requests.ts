import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Staff (admin or designer) view of design requests — deliberately excludes
// the client's name/email; that stays admin-only in /api/admin/overview.
export const Route = createFileRoute("/api/designer/requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const rows = await db()
          .prepare(
            `SELECT r.*, d.name AS claimed_by_name,
               (SELECT json_group_array(json_object('id', res.id, 'kind', res.kind, 'image_url', res.image_url, 'r2_key', res.r2_key))
                FROM request_results res WHERE res.request_id = r.id) AS results_json
             FROM design_requests r
             LEFT JOIN users d ON d.id = r.claimed_by
             ORDER BY r.created_at DESC
             LIMIT 500`,
          )
          .all();

        return json({ ok: true, requests: rows.results ?? [], me: auth.user.id });
      },
    },
  },
});
