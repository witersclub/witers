import { createFileRoute } from "@tanstack/react-router";

import { getMetaAdOAuthAccessToken } from "../../lib/meta-ad-account-connection.server";
import { getCampaignInsight } from "../../lib/meta-ads.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type CampaignRow = {
  id: string;
  meta_campaign_id: string;
  objective: string | null;
  daily_budget_cents: number | null;
  duration_days: number | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/api/campaign-for-request")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const requestId = new URL(request.url).searchParams.get("requestId") ?? "";
        if (!requestId) return json({ ok: false, error: "id_requerido" }, { status: 400 });
        const row = await db()
          .prepare(
            `SELECT id, meta_campaign_id, objective, daily_budget_cents,
                    duration_days, status, created_at
             FROM ad_campaigns
             WHERE user_id = ?1 AND request_id = ?2
             ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(user.id, requestId)
          .first<CampaignRow>();
        if (!row) return json({ ok: true, campaign: null });
        const token = await getMetaAdOAuthAccessToken(user.id);
        const insight = await getCampaignInsight(row.meta_campaign_id, undefined, token);
        return json({
          ok: true,
          campaign: {
            id: row.id,
            objective: row.objective,
            dailyBudgetCents: row.daily_budget_cents,
            durationDays: row.duration_days,
            createdAt: row.created_at,
            metaStatus: insight.ok ? insight.data.status : row.status.toUpperCase(),
            spend: insight.ok ? insight.data.spend : null,
            reach: insight.ok ? insight.data.reach : null,
            results: insight.ok ? insight.data.results : null,
          },
        });
      },
    },
  },
});
