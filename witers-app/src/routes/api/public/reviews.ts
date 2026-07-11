import { createFileRoute } from "@tanstack/react-router";

import { db, json } from "../../../lib/witers-auth.server";

// Public, unauthenticated: real client satisfaction ratings/feedback from
// the in-app survey (design_requests.satisfaction_*), paired with the piece
// they reviewed. Same trust boundary as /api/public/showcase — only
// finalized ("cerrada") requests, and only a client's own submitted rating,
// never fabricated. Client identity is deliberately narrowed to a first
// name + company (not the full account name) since this data was collected
// for internal quality tracking, not originally for public display.
export const Route = createFileRoute("/api/public/reviews")({
  server: {
    handlers: {
      GET: async () => {
        const rows = await db()
          .prepare(
            `SELECT r.id AS request_id, r.satisfaction_rating AS rating, r.satisfaction_feedback AS feedback,
                    r.company_name AS company_name, u.name AS client_name,
                    res.r2_key AS r2_key, res.image_url AS image_url
             FROM design_requests r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN request_results res ON res.id = (
               SELECT id FROM request_results
               WHERE request_id = r.id AND kind != 'draft'
               ORDER BY created_at DESC LIMIT 1
             )
             WHERE r.status = 'cerrada'
               AND r.satisfaction_rating IS NOT NULL
               AND res.id IS NOT NULL
             ORDER BY r.satisfaction_submitted_at DESC
             LIMIT 20`,
          )
          .all();

        const reviews = (rows.results ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          const fullName = typeof r.client_name === "string" ? r.client_name.trim() : "";
          const firstName = fullName ? fullName.split(/\s+/)[0] : "Cliente WITERS";
          return {
            request_id: r.request_id,
            rating: r.rating,
            feedback: r.feedback,
            company_name: r.company_name,
            first_name: firstName,
            r2_key: r.r2_key,
            image_url: r.image_url,
          };
        });

        return json({ ok: true, reviews });
      },
    },
  },
});
