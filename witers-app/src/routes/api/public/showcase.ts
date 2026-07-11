import { createFileRoute } from "@tanstack/react-router";

import { db, json } from "../../../lib/witers-auth.server";

// Public, unauthenticated: lists the most recent finalized ("cerrada")
// client deliverables for the homepage's "Clientes satisfechos" carousel.
// Only ever the single latest non-draft result per request — the same
// "one final piece per request" rule used everywhere else in the app.
export const Route = createFileRoute("/api/public/showcase")({
  server: {
    handlers: {
      GET: async () => {
        const rows = await db()
          .prepare(
            `SELECT res.id, res.r2_key, res.image_url, r.title
             FROM request_results res
             JOIN design_requests r ON r.id = res.request_id
             WHERE r.status = 'cerrada'
               AND res.kind != 'draft'
               AND res.id = (
                 SELECT id FROM request_results
                 WHERE request_id = r.id AND kind != 'draft'
                 ORDER BY created_at DESC LIMIT 1
               )
             ORDER BY res.created_at DESC
             LIMIT 24`,
          )
          .all();

        return json({ ok: true, pieces: rows.results ?? [] });
      },
    },
  },
});
