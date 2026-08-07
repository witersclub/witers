import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

export type TopPageRow = { path: string; n: number };
export type TopClickRow = { label: string; path: string; n: number };

// The WhatsApp click counts, plus top pages and top clicks (Wix
// "Comportamiento"-style) for the "Indicadores" tab — see site_events
// migration for why this is a generic event log rather than one table
// per indicator, so a future one can reuse it without its own migration.
export const Route = createFileRoute("/api/admin/site-events-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const [today, last7Days, total, topPages, topClicks] = await Promise.all([
          db()
            .prepare(
              `SELECT COUNT(*) AS n FROM site_events
               WHERE type = 'whatsapp_click' AND created_at > datetime('now', 'start of day')`,
            )
            .first<{ n: number }>(),
          db()
            .prepare(
              `SELECT COUNT(*) AS n FROM site_events
               WHERE type = 'whatsapp_click' AND created_at > datetime('now', '-7 days')`,
            )
            .first<{ n: number }>(),
          db()
            .prepare(`SELECT COUNT(*) AS n FROM site_events WHERE type = 'whatsapp_click'`)
            .first<{ n: number }>(),
          // Last 30 days — same window Wix's "Comportamiento" defaults to.
          db()
            .prepare(
              `SELECT path, COUNT(*) AS n FROM site_events
               WHERE type = 'page_view' AND created_at > datetime('now', '-30 days')
               GROUP BY path ORDER BY n DESC LIMIT 8`,
            )
            .all<TopPageRow>(),
          // whatsapp_click has no label (it's always the same button), so
          // it's folded in here as a fixed "WhatsApp" label — one unified
          // "top clicks" list instead of a separate card per click type.
          db()
            .prepare(
              `SELECT COALESCE(label, 'WhatsApp') AS label, path, COUNT(*) AS n FROM site_events
               WHERE type IN ('cta_click', 'whatsapp_click') AND created_at > datetime('now', '-30 days')
               GROUP BY label, path ORDER BY n DESC LIMIT 8`,
            )
            .all<TopClickRow>(),
        ]);

        return json({
          ok: true,
          whatsappClicks: {
            today: today?.n ?? 0,
            last7Days: last7Days?.n ?? 0,
            total: total?.n ?? 0,
          },
          topPages: topPages.results ?? [],
          topClicks: topClicks.results ?? [],
        });
      },
    },
  },
});
