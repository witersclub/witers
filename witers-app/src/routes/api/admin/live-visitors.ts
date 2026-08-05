import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

export type LiveVisitorRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  path: string;
  country: string | null;
  last_seen: string;
  duration_seconds: number;
};

// "Active" = a heartbeat in the last 45s — comfortably wider than the 5s
// client ping interval so a single missed/slow beat doesn't drop someone
// off the list, but tight enough to read as genuinely "right now".
export const Route = createFileRoute("/api/admin/live-visitors")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const [visitorRows, avgRow] = await Promise.all([
          db()
            .prepare(
              `SELECT id, user_id, user_name, user_role, path, country, last_seen,
                 CAST((julianday(last_seen) - julianday(session_started_at)) * 86400 AS INTEGER)
                   AS duration_seconds
               FROM visitor_heartbeats
               WHERE last_seen > datetime('now', '-45 seconds')
               ORDER BY last_seen DESC
               LIMIT 200`,
            )
            .all<LiveVisitorRow>(),
          // Same 24h window the lazy-sweep in /api/visitor-heartbeat keeps
          // the table bounded to, so this reads as "recent visitors", not
          // a skewed all-time average dragged down by ancient rows.
          db()
            .prepare(
              `SELECT AVG((julianday(last_seen) - julianday(session_started_at)) * 86400) AS avg
               FROM visitor_heartbeats
               WHERE last_seen > datetime('now', '-1 day')`,
            )
            .first<{ avg: number | null }>(),
        ]);

        return json({
          ok: true,
          visitors: visitorRows.results ?? [],
          avgSessionSeconds: avgRow?.avg != null ? Math.round(avgRow.avg) : null,
        });
      },
    },
  },
});
