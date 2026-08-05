import { createFileRoute } from "@tanstack/react-router";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Just the WhatsApp click counts the "Indicadores" tab needs today — see
// site_events migration for why this is a generic event log rather than a
// dedicated whatsapp_clicks table, so a future indicator can reuse it
// without its own migration.
export const Route = createFileRoute("/api/admin/site-events-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const [today, last7Days, total] = await Promise.all([
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
        ]);

        return json({
          ok: true,
          whatsappClicks: {
            today: today?.n ?? 0,
            last7Days: last7Days?.n ?? 0,
            total: total?.n ?? 0,
          },
        });
      },
    },
  },
});
