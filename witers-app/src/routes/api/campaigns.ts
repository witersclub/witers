import { createFileRoute } from "@tanstack/react-router";

import { getCampaignInsight } from "../../lib/meta-ads.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type CampaignRow = {
  id: string;
  request_id: string;
  meta_campaign_id: string;
  daily_budget_cents: number;
  status: string;
  created_at: string;
  request_title: string;
};

// Lists the current member's campaigns for the panel's Campañas tab, each
// refreshed with Meta's current status + spend/reach/clicks at request
// time — see meta-ads.server.ts for why this is "refresh on open," not a
// live push.
export const Route = createFileRoute("/api/campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare(
            `SELECT c.id, c.request_id, c.meta_campaign_id, c.daily_budget_cents, c.status, c.created_at,
                    r.title AS request_title
             FROM ad_campaigns c
             JOIN design_requests r ON r.id = c.request_id
             WHERE c.user_id = ?1
             ORDER BY c.created_at DESC`,
          )
          .bind(user.id)
          .all<CampaignRow>();

        const campaigns = await Promise.all(
          (rows.results ?? []).map(async (row) => {
            const insight = await getCampaignInsight(row.meta_campaign_id);
            return {
              id: row.id,
              requestId: row.request_id,
              requestTitle: row.request_title,
              dailyBudgetCents: row.daily_budget_cents,
              createdAt: row.created_at,
              // Meta's own statuses are uppercase (ACTIVE/PAUSED/...); the
              // local fallback stores lowercase, so normalize it to match
              // CAMPAIGN_STATUS_LABEL's keys in the panel.
              metaStatus: insight.ok ? insight.data.status : row.status.toUpperCase(),
              spend: insight.ok ? insight.data.spend : null,
              impressions: insight.ok ? insight.data.impressions : null,
              clicks: insight.ok ? insight.data.clicks : null,
              reach: insight.ok ? insight.data.reach : null,
              insightError: insight.ok ? null : insight.error,
            };
          }),
        );

        return json({ ok: true, campaigns });
      },
    },
  },
});
