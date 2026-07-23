import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Staff (admin or designer) view of carousel requests — mirrors
// /api/designer/video-requests.ts.
export const Route = createFileRoute("/api/designer/carousel-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const rows = await db()
          .prepare(
            `SELECT c.*, d.name AS claimed_by_name,
               (SELECT json_group_array(json_object(
                  'id', s.id, 'slide_index', s.slide_index, 'title', s.title, 'brief', s.brief,
                  'delivered_key', s.delivered_key, 'delivered_at', s.delivered_at,
                  'change_request_note', s.change_request_note, 'change_requested_at', s.change_requested_at
                ))
                FROM carousel_slides s WHERE s.carousel_request_id = c.id ORDER BY s.slide_index) AS slides_json
             FROM carousel_requests c
             LEFT JOIN users d ON d.id = c.claimed_by
             ORDER BY c.created_at DESC
             LIMIT 500`,
          )
          .all();

        return json({ ok: true, carouselRequests: rows.results ?? [], me: auth.user.id });
      },
    },
  },
});
