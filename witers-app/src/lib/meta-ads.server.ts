// Talks to Meta's Marketing API (Graph API) to show a client's real Meta ad
// campaigns inside their WITERS panel — read-only. Campaigns themselves are
// created by WITERS staff directly in Meta Ads Manager (a phone call with
// the client, not a self-serve wizard), inside the CLIENT'S OWN ad account:
// the client adds WITERS's Business Portfolio as a partner (Analyst access
// is enough) from their own Business Manager, and from then on the same
// System User token (META_ACCESS_TOKEN) can read that account too — only
// the ad account id varies per client, never the token. Which of a client's
// real campaigns actually show up in their dashboard is a staff choice (see
// /api/admin/meta-campaigns + /api/admin/link-campaign), not "all of them."

import process from "node:process";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type MetaConfig = {
  accessToken: string;
};

export function getMetaConfig(): MetaConfig | { error: string } {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) return { error: "falta_meta_access_token" };
  return { accessToken };
}

type GraphError = {
  error?: { message?: string; type?: string; code?: number; error_user_msg?: string };
};

async function graphRequest<T>(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    let response: Response;
    if (method === "GET") {
      url.searchParams.set("access_token", accessToken);
      for (const [key, value] of Object.entries(body ?? {})) {
        url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
      response = await fetch(url.toString(), { signal: controller.signal });
    } else {
      const form = new URLSearchParams();
      form.set("access_token", accessToken);
      for (const [key, value] of Object.entries(body ?? {})) {
        form.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
      response = await fetch(url.toString(), {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
    }
    const json = (await response.json().catch(() => ({}))) as T & GraphError;
    if (!response.ok || json.error) {
      // error_user_msg (when Meta sets it) is the human-readable reason —
      // "message" alone is often as generic as "Invalid parameter", which
      // isn't enough to diagnose which field was wrong.
      const detail = json.error?.error_user_msg ?? json.error?.message ?? `HTTP ${response.status}`;
      console.info("[meta-ads] graph error", path, JSON.stringify(json.error));
      return { ok: false, error: detail };
    }
    return { ok: true, data: json };
  } catch (err) {
    console.info("[meta-ads] graph request threw", path, err);
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }
}

export type AdAccountCampaign = {
  id: string;
  name: string;
  status: string;
  dailyBudgetCents: number | null;
};

// Every campaign that currently exists in a client's own ad account —
// staff-only (see /api/admin/meta-campaigns), used to pick which ones get
// linked into that client's dashboard. A permission error here almost
// always means the client hasn't approved WITERS's partner-access request
// on their Business Manager yet (or the account id was typed wrong) —
// there's no way to check that ahead of time, the API call itself is the
// check.
export async function listAdAccountCampaigns(
  adAccountId: string,
): Promise<{ ok: true; data: AdAccountCampaign[] } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };
  const res = await graphRequest<{
    data: Array<{ id: string; name: string; status: string; daily_budget?: string }>;
  }>(
    `/act_${adAccountId}/campaigns`,
    config.accessToken,
    { fields: "id,name,status,daily_budget", limit: 200 },
    "GET",
  );
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res.data.data.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      dailyBudgetCents: c.daily_budget ? Number(c.daily_budget) : null,
    })),
  };
}

export type CampaignInsight = {
  campaignId: string;
  name: string;
  status: string;
  dailyBudgetCents: number | null;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
};

// Pulls current name/status/budget/performance for one campaign — called
// each time the client opens the Campañas tab (or on an auto-refresh
// timer), never pushed. Meta's own reporting has a small inherent delay;
// see the "tiempo real" conversation this is built to match. Name and
// budget come live from Meta rather than a local cache so a manually
// linked campaign (no local record of either) and a client-facing display
// both work the same way.
export async function getCampaignInsight(
  campaignId: string,
): Promise<{ ok: true; data: CampaignInsight } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const campaignRes = await graphRequest<{ name: string; status: string; daily_budget?: string }>(
    `/${campaignId}`,
    config.accessToken,
    { fields: "name,status,daily_budget" },
    "GET",
  );
  if (!campaignRes.ok) return { ok: false, error: campaignRes.error };

  const insightsRes = await graphRequest<{
    data: Array<{ spend?: string; impressions?: string; clicks?: string; reach?: string }>;
  }>(`/${campaignId}/insights`, config.accessToken, {}, "GET");

  const row = insightsRes.ok ? insightsRes.data.data[0] : undefined;
  return {
    ok: true,
    data: {
      campaignId,
      name: campaignRes.data.name,
      status: campaignRes.data.status,
      dailyBudgetCents: campaignRes.data.daily_budget
        ? Number(campaignRes.data.daily_budget)
        : null,
      spend: row?.spend ?? "0",
      impressions: row?.impressions ?? "0",
      clicks: row?.clicks ?? "0",
      reach: row?.reach ?? "0",
    },
  };
}
