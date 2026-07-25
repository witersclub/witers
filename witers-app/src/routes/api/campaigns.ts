import { createFileRoute } from "@tanstack/react-router";

import { getCampaignInsight } from "../../lib/meta-ads.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type CampaignRow = {
  id: string;
  meta_campaign_id: string;
  status: string;
  created_at: string;
};

// Lists the current member's campaigns for the panel's Campañas tab, each
// refreshed with Meta's current name/status/budget/spend/reach/clicks at
// request time — see meta-ads.server.ts for why this is "refresh on open,"
// not a live push. Name and budget always come from Meta, never a local
// column: campaigns are staff-linked from the client's own ad account now
// (see /api/admin/link-campaign), so there's nothing locally cached to
// fall back to.
export const Route = createFileRoute("/api/campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare(
            `SELECT id, meta_campaign_id, status, created_at
             FROM ad_campaigns
             WHERE user_id = ?1
             ORDER BY created_at DESC`,
          )
          .bind(user.id)
          .all<CampaignRow>();

        const campaigns = await Promise.all(
          (rows.results ?? []).map(async (row) => {
            const insight = await getCampaignInsight(row.meta_campaign_id);
            return {
              id: row.id,
              name: insight.ok ? insight.data.name : null,
              dailyBudgetCents: insight.ok ? insight.data.dailyBudgetCents : null,
              createdAt: row.created_at,
              // Meta's own statuses are uppercase (ACTIVE/PAUSED/...); the
              // local fallback stores lowercase, so normalize it to match
              // CAMPAIGN_STATUS_LABEL's keys in the panel.
              metaStatus: insight.ok ? insight.data.status : row.status.toUpperCase(),
              spend: insight.ok ? insight.data.spend : null,
              impressions: insight.ok ? insight.data.impressions : null,
              clicks: insight.ok ? insight.data.clicks : null,
              reach: insight.ok ? insight.data.reach : null,
              results: insight.ok ? insight.data.results : null,
              costPerResult: insight.ok ? insight.data.costPerResult : null,
              previewImageUrls: insight.ok ? insight.data.previewImageUrls : [],
              insightError: insight.ok ? null : insight.error,
            };
          }),
        );

        return json({ ok: true, campaigns });
      },
    },
  },
});
