// Talks to Meta's Marketing API (Graph API) to turn a finished WITERS piece
// into a real (but paused, never auto-activated) ad campaign — the
// "Quiero pautar" button in panel.tsx. Uses a Business Portfolio System
// User token (META_ACCESS_TOKEN), not per-client OAuth: for now every
// campaign is created in WITERS's own connected ad account, following the
// "manual connection, few clients" approach agreed on before building this.

import process from "node:process";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type MetaConfig = {
  accessToken: string;
  adAccountId: string; // numeric, WITHOUT the "act_" prefix
  pageId: string | null;
};

// pageId is optional here (only the final ad-creative step needs it) so
// campaign/ad-set creation can already be tested before that's configured.
export function getMetaConfig(): MetaConfig | { error: string } {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken) return { error: "falta_meta_access_token" };
  if (!adAccountId) return { error: "falta_meta_ad_account_id" };
  return {
    accessToken,
    adAccountId,
    pageId: process.env.META_PAGE_ID || null,
  };
}

type GraphError = { error?: { message?: string; type?: string; code?: number } };

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
      const detail = json.error?.message ?? `HTTP ${response.status}`;
      console.info("[meta-ads] graph error", path, detail);
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

// Mexico-only targeting for now (matches the MXN pricing used everywhere
// else in the app) — age range parsed from the client's own answer when
// they created the piece (e.g. "25-34, 35-44"), falling back to a broad
// default when that wasn't collected or doesn't parse.
function parseAgeRange(ageRange: string | null): { min: number; max: number } {
  const numbers = (ageRange ?? "").match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return { min: 18, max: 65 };
  const min = Math.max(13, Math.min(...numbers));
  const max = Math.min(65, Math.max(...numbers));
  return { min: min <= max ? min : 18, max: max >= min ? max : 65 };
}

export type CreatePausedCampaignInput = {
  requestTitle: string;
  audience: string | null;
  ageRange: string | null;
  dailyBudgetCents: number;
  imageBytesBase64: string;
  imageContentType: string;
  adMessage: string;
};

export type CreatePausedCampaignResult =
  | {
      ok: true;
      campaignId: string;
      adsetId: string;
      adId: string | null;
      // Set when everything up to the ad set worked but the final ad
      // (which needs a connected Facebook Page) couldn't be created —
      // the campaign/ad set still exist and are visible in Ads Manager.
      warning?: string;
    }
  | { ok: false; error: string };

// Orchestrates campaign → ad set → (image upload → creative → ad), all
// created with status PAUSED. Stops and reports a warning after the ad set
// if no Page is configured yet (META_PAGE_ID) — the campaign itself is
// still real and visible in the client's Ads Manager, just without a
// finished ad in it yet.
export async function createPausedCampaignForRequest(
  input: CreatePausedCampaignInput,
): Promise<CreatePausedCampaignResult> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };
  const { accessToken, adAccountId, pageId } = config;
  const act = `act_${adAccountId}`;

  const campaign = await graphRequest<{ id: string }>(`/${act}/campaigns`, accessToken, {
    name: `WITERS — ${input.requestTitle}`,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    special_ad_categories: [],
  });
  if (!campaign.ok) return { ok: false, error: campaign.error };

  const { min, max } = parseAgeRange(input.ageRange);
  const adset = await graphRequest<{ id: string }>(`/${act}/adsets`, accessToken, {
    name: `WITERS — ${input.requestTitle}`,
    campaign_id: campaign.data.id,
    daily_budget: input.dailyBudgetCents,
    billing_event: "IMPRESSIONS",
    optimization_goal: "POST_ENGAGEMENT",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: {
      geo_locations: { countries: ["MX"] },
      age_min: min,
      age_max: max,
    },
    status: "PAUSED",
  });
  if (!adset.ok) {
    return {
      ok: true,
      campaignId: campaign.data.id,
      adsetId: "",
      adId: null,
      warning: `La campaña se creó, pero el conjunto de anuncios falló: ${adset.error}`,
    };
  }

  if (!pageId) {
    return {
      ok: true,
      campaignId: campaign.data.id,
      adsetId: adset.data.id,
      adId: null,
      warning:
        "La campaña y el conjunto de anuncios se crearon en pausa. Falta conectar una Página de Facebook para generar el anuncio final.",
    };
  }

  const imageUpload = await graphRequest<{ images: Record<string, { hash: string }> }>(
    `/${act}/adimages`,
    accessToken,
    { bytes: input.imageBytesBase64 },
  );
  if (!imageUpload.ok) {
    return {
      ok: true,
      campaignId: campaign.data.id,
      adsetId: adset.data.id,
      adId: null,
      warning: `La campaña y el conjunto de anuncios se crearon, pero no pudimos subir la imagen: ${imageUpload.error}`,
    };
  }
  const imageHash = Object.values(imageUpload.data.images)[0]?.hash;
  if (!imageHash) {
    return {
      ok: true,
      campaignId: campaign.data.id,
      adsetId: adset.data.id,
      adId: null,
      warning:
        "La campaña y el conjunto de anuncios se crearon, pero la imagen no se pudo procesar.",
    };
  }

  const creative = await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
    name: `WITERS — ${input.requestTitle}`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        image_hash: imageHash,
        message: input.adMessage,
        link: `https://www.facebook.com/${pageId}`,
      },
    },
  });
  if (!creative.ok) {
    return {
      ok: true,
      campaignId: campaign.data.id,
      adsetId: adset.data.id,
      adId: null,
      warning: `La campaña y el conjunto de anuncios se crearon, pero el anuncio falló: ${creative.error}`,
    };
  }

  const ad = await graphRequest<{ id: string }>(`/${act}/ads`, accessToken, {
    name: `WITERS — ${input.requestTitle}`,
    adset_id: adset.data.id,
    creative: { creative_id: creative.data.id },
    status: "PAUSED",
  });
  if (!ad.ok) {
    return {
      ok: true,
      campaignId: campaign.data.id,
      adsetId: adset.data.id,
      adId: null,
      warning: `La campaña y el conjunto de anuncios se crearon, pero el anuncio final falló: ${ad.error}`,
    };
  }

  return {
    ok: true,
    campaignId: campaign.data.id,
    adsetId: adset.data.id,
    adId: ad.data.id,
  };
}

export type CampaignInsight = {
  campaignId: string;
  status: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
};

// Pulls current status + performance for one campaign — called each time
// the client opens the Campañas tab (or on an auto-refresh timer), never
// pushed. Meta's own reporting has a small inherent delay; see the "tiempo
// real" conversation this is built to match.
export async function getCampaignInsight(
  campaignId: string,
): Promise<{ ok: true; data: CampaignInsight } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const statusRes = await graphRequest<{ status: string }>(
    `/${campaignId}`,
    config.accessToken,
    { fields: "status" },
    "GET",
  );
  if (!statusRes.ok) return { ok: false, error: statusRes.error };

  const insightsRes = await graphRequest<{
    data: Array<{ spend?: string; impressions?: string; clicks?: string; reach?: string }>;
  }>(`/${campaignId}/insights`, config.accessToken, {}, "GET");

  const row = insightsRes.ok ? insightsRes.data.data[0] : undefined;
  return {
    ok: true,
    data: {
      campaignId,
      status: statusRes.data.status,
      spend: row?.spend ?? "0",
      impressions: row?.impressions ?? "0",
      clicks: row?.clicks ?? "0",
      reach: row?.reach ?? "0",
    },
  };
}
