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

type ActionRow = { action_type?: string; value?: string };

// What Ads Manager's "Resultados" column actually counts isn't "clicks" —
// it's the specific action tied to whatever the campaign's ad sets are
// optimizing for (a WhatsApp conversation started, a lead form submit, a
// purchase...), since plenty of clicks never turn into that. Meta's own UI
// picks the action_type(s) below based on the ad set's optimization_goal;
// this mirrors that mapping for the goals WITERS clients actually run.
// Candidates are tried in order — first one present in `actions` wins.
const RESULT_ACTION_TYPES: Record<string, string[]> = {
  CONVERSATIONS: ["onsite_conversion.messaging_conversation_started_7d"],
  REPLIES: [
    "onsite_conversion.total_messaging_connection",
    "onsite_conversion.messaging_conversation_started_7d",
  ],
  LEAD_GENERATION: ["lead", "onsite_conversion.lead_grouped"],
  QUALITY_LEAD: ["lead", "onsite_conversion.lead_grouped"],
  OFFSITE_CONVERSIONS: ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
  LINK_CLICKS: ["link_click"],
  LANDING_PAGE_VIEWS: ["landing_page_view"],
  POST_ENGAGEMENT: ["post_engagement"],
  PAGE_LIKES: ["like"],
  APP_INSTALLS: ["mobile_app_install", "app_install"],
};

// Best-effort — an ad set optimizing for something not in the table above
// (or with no matching action recorded yet) falls back to raw clicks rather
// than showing a confident-looking zero.
function countResults(
  actions: ActionRow[] | undefined,
  optimizationGoal: string | null,
  fallbackClicks: string,
): string {
  const candidates = optimizationGoal ? RESULT_ACTION_TYPES[optimizationGoal] : undefined;
  if (!candidates || !actions) return fallbackClicks;
  for (const type of candidates) {
    const match = actions.find((a) => a.action_type === type);
    if (match?.value) return match.value;
  }
  return fallbackClicks;
}

// Ad sets under one campaign normally share the same optimization goal (one
// WhatsApp/leads/traffic campaign per phone call with the client) — reading
// just the first one keeps this to a single extra call instead of one per
// ad set.
async function getCampaignOptimizationGoal(
  campaignId: string,
  accessToken: string,
): Promise<string | null> {
  const res = await graphRequest<{ data: Array<{ optimization_goal?: string }> }>(
    `/${campaignId}/adsets`,
    accessToken,
    { fields: "optimization_goal", limit: 1 },
    "GET",
  );
  return res.ok ? (res.data.data[0]?.optimization_goal ?? null) : null;
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
  // What actually converted, per the ad set's own optimization goal — not
  // every click does. See RESULT_ACTION_TYPES; falls back to `clicks` when
  // the goal isn't one we recognize.
  results: string;
  // Every ad's creative image running under this campaign, straight from
  // Meta — not local WITERS files, since a manually linked campaign has no
  // local record of which delivered piece(s) it corresponds to. Empty when
  // the campaign has no ads yet, or none of its creatives are plain images
  // (video/carousel/dynamic creative aren't previewed here).
  previewImageUrls: string[];
};

type AdCreativeField = { creative?: { image_url?: string; thumbnail_url?: string } };

// Pulls current name/status/budget/performance/creative-preview for one
// campaign — called each time the client opens the Campañas tab (or on an
// auto-refresh timer), never pushed. Meta's own reporting has a small
// inherent delay; see the "tiempo real" conversation this is built to
// match. Name, budget, and the preview image come live from Meta rather
// than a local cache so a manually linked campaign (no local record of any
// of them) and a client-facing display both work the same way.
export async function getCampaignInsight(
  campaignId: string,
): Promise<{ ok: true; data: CampaignInsight } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const [campaignRes, insightsRes, adsRes, optimizationGoal] = await Promise.all([
    graphRequest<{ name: string; status: string; daily_budget?: string }>(
      `/${campaignId}`,
      config.accessToken,
      { fields: "name,status,daily_budget" },
      "GET",
    ),
    // Both fields and date_preset must be explicit — Meta's insights edge,
    // if called with neither, silently falls back to its own default field
    // set (which includes spend but not reach/clicks) over its own default
    // date window, not "the campaign's lifetime." Without this, reach/
    // clicks read as 0 for every campaign (never actually missing, just
    // never requested), and spend reads as a partial recent window instead
    // of the true total.
    graphRequest<{
      data: Array<{
        spend?: string;
        impressions?: string;
        clicks?: string;
        reach?: string;
        actions?: ActionRow[];
      }>;
    }>(
      `/${campaignId}/insights`,
      config.accessToken,
      { fields: "spend,impressions,clicks,reach,actions", date_preset: "maximum" },
      "GET",
    ),
    // The campaign node's own /ads edge lists every ad in it regardless of
    // which ad set it's under — no need to enumerate ad sets separately.
    // image_url/thumbnail_url on the creative are pre-signed by Meta, so
    // they can go straight into an <img src> with no extra proxying.
    graphRequest<{ data: AdCreativeField[] }>(
      `/${campaignId}/ads`,
      config.accessToken,
      { fields: "creative{image_url,thumbnail_url}", limit: 25 },
      "GET",
    ),
    getCampaignOptimizationGoal(campaignId, config.accessToken),
  ]);
  if (!campaignRes.ok) return { ok: false, error: campaignRes.error };

  const row = insightsRes.ok ? insightsRes.data.data[0] : undefined;
  const previewImageUrls = adsRes.ok
    ? adsRes.data.data
        .map((a) => a.creative?.image_url ?? a.creative?.thumbnail_url ?? null)
        .filter((url): url is string => url !== null)
    : [];

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
      results: countResults(row?.actions, optimizationGoal, row?.clicks ?? "0"),
      previewImageUrls,
    },
  };
}

export type AdDetail = {
  id: string;
  name: string;
  status: string;
  previewImageUrl: string | null;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  results: string;
};

// Per-ad breakdown for one campaign — the drill-down a client reaches by
// opening a campaign card, showing which specific ad(s) got the clicks/spend
// instead of just the campaign's total. `level: "ad"` on the insights edge
// is what makes Meta return one row per ad (keyed by ad_id) instead of one
// aggregated row for the whole campaign; matched up with /ads (name/status/
// creative) by id.
export async function getCampaignAdDetails(
  campaignId: string,
): Promise<{ ok: true; data: AdDetail[] } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const [adsRes, insightsRes, optimizationGoal] = await Promise.all([
    graphRequest<{
      data: Array<{
        id: string;
        name: string;
        status: string;
        creative?: { image_url?: string; thumbnail_url?: string };
      }>;
    }>(
      `/${campaignId}/ads`,
      config.accessToken,
      { fields: "id,name,status,creative{image_url,thumbnail_url}", limit: 50 },
      "GET",
    ),
    graphRequest<{
      data: Array<{
        ad_id?: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        reach?: string;
        actions?: ActionRow[];
      }>;
    }>(
      `/${campaignId}/insights`,
      config.accessToken,
      {
        level: "ad",
        fields: "ad_id,spend,impressions,clicks,reach,actions",
        date_preset: "maximum",
      },
      "GET",
    ),
    getCampaignOptimizationGoal(campaignId, config.accessToken),
  ]);
  if (!adsRes.ok) return { ok: false, error: adsRes.error };

  const insightByAdId = new Map(
    insightsRes.ok ? insightsRes.data.data.map((row) => [row.ad_id, row]) : [],
  );

  return {
    ok: true,
    data: adsRes.data.data.map((ad) => {
      const row = insightByAdId.get(ad.id);
      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        previewImageUrl: ad.creative?.image_url ?? ad.creative?.thumbnail_url ?? null,
        spend: row?.spend ?? "0",
        impressions: row?.impressions ?? "0",
        clicks: row?.clicks ?? "0",
        reach: row?.reach ?? "0",
        results: countResults(row?.actions, optimizationGoal, row?.clicks ?? "0"),
      };
    }),
  };
}
