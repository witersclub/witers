import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Per-designer counts of pieces finalized by the client, used for the
// "5 pieces = 100 créditos" progress bars in the designer panel. Images
// have an explicit client-confirm step (status becomes "cerrada" only
// after the client closes it — see /api/close-request); video and
// carousel requests have no such step, "completada" (delivered) is
// already their terminal state.
export const Route = createFileRoute("/api/designer/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const [images, videos, carousels] = await Promise.all([
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM design_requests WHERE claimed_by = ?1 AND status = 'cerrada'",
            )
            .bind(auth.user.id)
            .first<{ n: number }>(),
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM video_requests WHERE claimed_by = ?1 AND status = 'completada'",
            )
            .bind(auth.user.id)
            .first<{ n: number }>(),
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM carousel_requests WHERE claimed_by = ?1 AND status = 'completada'",
            )
            .bind(auth.user.id)
            .first<{ n: number }>(),
        ]);

        return json({
          ok: true,
          images: images?.n ?? 0,
          videos: videos?.n ?? 0,
          carousels: carousels?.n ?? 0,
        });
      },
    },
  },
});
