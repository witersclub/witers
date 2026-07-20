import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Staff (admin or designer) view of video requests — mirrors
// /api/designer/requests.ts for design_requests.
export const Route = createFileRoute("/api/designer/video-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const rows = await db()
          .prepare(
            `SELECT v.*, d.name AS claimed_by_name,
               (SELECT json_group_array(json_object('id', f.id, 'original_name', f.original_name, 'r2_key', f.r2_key))
                FROM video_request_raw_files f WHERE f.video_request_id = v.id) AS raw_files_json
             FROM video_requests v
             LEFT JOIN users d ON d.id = v.claimed_by
             ORDER BY v.created_at DESC
             LIMIT 500`,
          )
          .all();

        return json({ ok: true, videoRequests: rows.results ?? [], me: auth.user.id });
      },
    },
  },
});
