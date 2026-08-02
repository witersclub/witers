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

        const rows = await db()
          .prepare(
            `SELECT id, user_id, user_name, user_role, path, country, last_seen
             FROM visitor_heartbeats
             WHERE last_seen > datetime('now', '-45 seconds')
             ORDER BY last_seen DESC
             LIMIT 200`,
          )
          .all<LiveVisitorRow>();

        return json({ ok: true, visitors: rows.results ?? [] });
      },
    },
  },
});
