import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";
import { readVisitorId, visitorCookie } from "../../lib/visitor.server";

const schema = z.object({ path: z.string().max(300) });

// Cloudflare populates `cf` on every request at the edge — see
// /api/geo-price and /api/designer/stats for the same cast/pattern.
type CfRequest = Request & { cf?: { country?: string } };

// Public, unauthenticated — fired every few seconds from every page (see
// LiveVisitorHeartbeat, mounted once in __root.tsx) so the admin "En vivo"
// panel can show who's actually browsing right now, logged in or not.
export const Route = createFileRoute("/api/visitor-heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false }, { status: 400 });

        const existingId = readVisitorId(request);
        const visitorId = existingId ?? crypto.randomUUID();
        const user = await getSessionUser(request);
        const country = (request as CfRequest).cf?.country ?? null;

        // A heartbeat whose path differs from this visitor's last known
        // path is a page view — piggybacking on the heartbeat (which
        // already fires on mount and on every client-side route change,
        // see LiveVisitorHeartbeat) instead of a separate tracker/request
        // for the admin "Páginas principales" list.
        const existingRow = await db()
          .prepare(`SELECT path FROM visitor_heartbeats WHERE id = ?1`)
          .bind(visitorId)
          .first<{ path: string }>();
        const isNewPageView = !existingRow || existingRow.path !== parsed.data.path;

        await db()
          .prepare(
            `INSERT INTO visitor_heartbeats (id, user_id, user_name, user_role, path, country, last_seen, session_started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
             ON CONFLICT (id) DO UPDATE SET
               user_id = excluded.user_id,
               user_name = excluded.user_name,
               user_role = excluded.user_role,
               path = excluded.path,
               country = excluded.country,
               -- A gap over 30 minutes since the last heartbeat counts as
               -- a new session (same boundary Google Analytics uses) —
               -- otherwise this keeps accumulating from the same start.
               session_started_at = CASE
                 WHEN visitor_heartbeats.last_seen < datetime('now', '-30 minutes')
                   THEN datetime('now')
                 ELSE visitor_heartbeats.session_started_at
               END,
               last_seen = datetime('now')`,
          )
          .bind(
            visitorId,
            user?.id ?? null,
            user?.name ?? null,
            user?.role ?? null,
            parsed.data.path,
            country,
          )
          .run();

        // Only public-site views feed "Páginas principales" — /panel,
        // /admin and /witer are internal, already-authenticated screens
        // that would otherwise drown out the public pages an admin
        // actually wants to see traffic for.
        if (
          isNewPageView &&
          !parsed.data.path.startsWith("/panel") &&
          !parsed.data.path.startsWith("/admin") &&
          !parsed.data.path.startsWith("/witer")
        ) {
          await db()
            .prepare(
              `INSERT INTO site_events (id, type, path, visitor_id, user_id, country)
               VALUES (?1, 'page_view', ?2, ?3, ?4, ?5)`,
            )
            .bind(crypto.randomUUID(), parsed.data.path, visitorId, user?.id ?? null, country)
            .run();
        }

        // No cron in this project — bound table growth lazily instead of
        // with a scheduled job: a small chance on every heartbeat to sweep
        // rows that have been stale for a day. Cheap (indexed on
        // last_seen), and never blocks the response if it's skipped.
        if (Math.random() < 0.02) {
          await db()
            .prepare("DELETE FROM visitor_heartbeats WHERE last_seen < datetime('now', '-1 day')")
            .run();
        }

        return json(
          { ok: true },
          existingId ? {} : { headers: { "set-cookie": visitorCookie(visitorId) } },
        );
      },
    },
  },
});
