// Talks to Meta's Marketing API (Graph API) to show a client's real Meta ad
// campaigns inside their WITERS panel — read-only. Campaigns themselves are
// created by WITERS staff directly in Meta Ads Manager (a phone call with
// the client, not a self-serve wizard), inside the CLIENT'S OWN ad account,
// never a shared/WITERS-owned one — there is no such thing here.
//
// The connection procedure, always the same for every client:
//   1. The client adds WITERS's Business Portfolio as a partner (Analyst
//      access is enough) from their own Meta Business Manager.
//   2. Once accepted, that ad account shows up in WITERS's own Business
//      Manager account list — staff copies its id from there.
//   3. Staff pastes that id into the client's brand profile from the admin
//      panel (see /api/admin/update-brand-profile), which is what actually
//      turns on their Campañas dashboard.
// The same System User token (META_ACCESS_TOKEN) reads every client's
// account this way — only the ad account id varies per client, never the
// token. Nothing here is per-client Meta OAuth, so it doesn't request
// ads_management/ads_read from anyone via login — no client-facing
// permission screen, no App Review trigger from this flow.
//
// Which of a client's real campaigns actually show up in their dashboard is
// a separate staff choice (see /api/admin/meta-campaigns +
// /api/admin/link-campaign), not "all of them."

import process from "node:process";

import { META_GRAPH_BASE as GRAPH_BASE } from "./meta-graph-version.server";

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

// WITERS clients run click-to-WhatsApp/Messenger campaigns almost
// exclusively, so "Resultados" means one thing: conversations started —
// not clicks (plenty never turn into a chat), and not a generic per-goal
// mapping. Multiple action_type variants exist depending on the attribution
// window Meta picked for the account; tried in order, first match wins.
const CONVERSATION_STARTED_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "onsite_conversion.messaging_conversation_started_28d",
  "onsite_conversion.messaging_conversation_started_1d",
];

// A real "0 resultados" is far more honest here than quietly substituting
// clicks again — that substitution was the exact confusion this replaced.
function countConversationsStarted(actions: ActionRow[] | undefined): string {
  if (!actions) return "0";
  for (const type of CONVERSATION_STARTED_ACTION_TYPES) {
    const match = actions.find((a) => a.action_type === type);
    if (match?.value) return match.value;
  }
  return "0";
}

// Meta reports cost-per-result per action_type directly (cost_per_action_type)
// rather than making callers divide spend/results themselves — using it
// keeps this in sync with whatever rounding/currency Ads Manager itself
// applies. Falls back to a manual spend/results divide only if Meta didn't
// return it (e.g. zero results, nothing to divide by).
function costPerConversation(
  costPerActionType: ActionRow[] | undefined,
  spend: string,
  results: string,
): string {
  if (costPerActionType) {
    for (const type of CONVERSATION_STARTED_ACTION_TYPES) {
      const match = costPerActionType.find((a) => a.action_type === type);
      if (match?.value) return match.value;
    }
  }
  const resultsNum = Number(results);
  return resultsNum > 0 ? (Number(spend) / resultsNum).toFixed(2) : "0";
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
  // Conversations started — see CONVERSATION_STARTED_ACTION_TYPES. A real
  // click count that never converted isn't the same as a click that did.
  results: string;
  // What each conversation cost, in the account's currency — Meta's own
  // cost_per_action_type when available, spend/results otherwise.
  costPerResult: string;
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
  range?: { since: string; until: string },
  accessTokenOverride?: string | null,
): Promise<{ ok: true; data: CampaignInsight } | { ok: false; error: string }> {
  const config = accessTokenOverride ? { accessToken: accessTokenOverride } : getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const [campaignRes, insightsRes, adsRes] = await Promise.all([
    graphRequest<{ name: string; status: string; daily_budget?: string }>(
      `/${campaignId}`,
      config.accessToken,
      { fields: "name,status,daily_budget" },
      "GET",
    ),
    // Both fields and date_preset/time_range must be explicit — Meta's
    // insights edge, if called with neither, silently falls back to its own
    // default field set (which includes spend but not reach/clicks) over
    // its own default date window, not "the campaign's lifetime." Without
    // this, reach/clicks read as 0 for every campaign (never actually
    // missing, just never requested), and spend reads as a partial recent
    // window instead of the true total. `range`, when given (the
    // Campañas-tab date-range picker), uses an explicit `time_range` the
    // same way getCampaignAdDetails does — see that function for why.
    graphRequest<{
      data: Array<{
        spend?: string;
        impressions?: string;
        clicks?: string;
        reach?: string;
        actions?: ActionRow[];
        cost_per_action_type?: ActionRow[];
      }>;
    }>(
      `/${campaignId}/insights`,
      config.accessToken,
      {
        fields: "spend,impressions,clicks,reach,actions,cost_per_action_type",
        ...(range
          ? { time_range: { since: range.since, until: range.until } }
          : { date_preset: "maximum" }),
      },
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
  ]);
  if (!campaignRes.ok) return { ok: false, error: campaignRes.error };

  const row = insightsRes.ok ? insightsRes.data.data[0] : undefined;
  const previewImageUrls = adsRes.ok
    ? adsRes.data.data
        .map((a) => a.creative?.image_url ?? a.creative?.thumbnail_url ?? null)
        .filter((url): url is string => url !== null)
    : [];
  const results = countConversationsStarted(row?.actions);

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
      results,
      costPerResult: costPerConversation(row?.cost_per_action_type, row?.spend ?? "0", results),
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
  costPerResult: string;
};

// Per-ad breakdown for one campaign — the drill-down a client reaches by
// opening a campaign card, showing which specific ad(s) got the clicks/spend
// instead of just the campaign's total. `level: "ad"` on the insights edge
// is what makes Meta return one row per ad (keyed by ad_id) instead of one
// aggregated row for the whole campaign; matched up with /ads (name/status/
// creative) by id.
export async function getCampaignAdDetails(
  campaignId: string,
  range?: { since: string; until: string },
  accessTokenOverride?: string | null,
): Promise<{ ok: true; data: AdDetail[] } | { ok: false; error: string }> {
  const config = accessTokenOverride ? { accessToken: accessTokenOverride } : getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const [adsRes, insightsRes] = await Promise.all([
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
    // Same "fields and date must both be explicit" reasoning as
    // getCampaignInsight above. `range` (an exact since/until, from the
    // client's date-range picker in the campaign detail modal) uses
    // `time_range` instead of `date_preset` — Meta's presets top out at
    // named windows like last_7d, nothing that maps onto an arbitrary
    // 1/2/5/10-day pick, so an explicit range is the only way to get
    // those exactly. No `range` (the default view) keeps the original
    // full-lifetime "maximum" behavior.
    graphRequest<{
      data: Array<{
        ad_id?: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        reach?: string;
        actions?: ActionRow[];
        cost_per_action_type?: ActionRow[];
      }>;
    }>(
      `/${campaignId}/insights`,
      config.accessToken,
      {
        level: "ad",
        fields: "ad_id,spend,impressions,clicks,reach,actions,cost_per_action_type",
        ...(range
          ? { time_range: { since: range.since, until: range.until } }
          : { date_preset: "maximum" }),
      },
      "GET",
    ),
  ]);
  if (!adsRes.ok) return { ok: false, error: adsRes.error };

  const insightByAdId = new Map(
    insightsRes.ok ? insightsRes.data.data.map((row) => [row.ad_id, row]) : [],
  );

  return {
    ok: true,
    data: adsRes.data.data.map((ad) => {
      const row = insightByAdId.get(ad.id);
      const results = countConversationsStarted(row?.actions);
      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        previewImageUrl: ad.creative?.image_url ?? ad.creative?.thumbnail_url ?? null,
        spend: row?.spend ?? "0",
        impressions: row?.impressions ?? "0",
        clicks: row?.clicks ?? "0",
        reach: row?.reach ?? "0",
        results,
        costPerResult: costPerConversation(row?.cost_per_action_type, row?.spend ?? "0", results),
      };
    }),
  };
}
