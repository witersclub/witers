// Talks to Meta's Marketing API (Graph API) to turn a finished WITERS piece
// into a real (but paused, never auto-activated) ad campaign — the "Pauta
// interactiva" screen in panel.tsx. Uses a Business Portfolio System User
// token (META_ACCESS_TOKEN), not per-client OAuth. Every campaign is
// created in the ad account explicitly connected to the current brand.
// The Facebook Page, unlike the ad account, is per-client (each client's
// ads must publish from their own Page) — callers pass it in explicitly
// from that client's brand_profiles.meta_page_id, never from env config.

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

// ---------- targeting search (location + interest autocomplete) ----------

export type LocationSuggestion = { key: string; name: string; type: string; region: string | null };

// Meta's own place search (city/neighborhood/zip) — the same one Ads
// Manager itself uses, so there's no need for a separate geocoding service
// or street addresses. The chosen key gets a radius attached at campaign
// creation time (geo_locations.cities[].radius), same mechanism real
// campaigns use for "exact location + radius" targeting.
export async function searchMetaLocations(
  query: string,
  // ISO 3166-1 alpha-2 (e.g. "MX"). Without this, a zip search matches
  // globally — "05348" returned a São Paulo, Brazil match ahead of the
  // Mexican one — so the client picks a country (default México) instead
  // of it being hardcoded, since a client may legitimately want to target
  // a different country from where WITERS itself operates.
  countryCode: string,
): Promise<{ ok: true; data: LocationSuggestion[] } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };
  type LocationSearchData = {
    data: Array<{ key: string; name: string; type: string; region?: string }>;
  };
  // Ads Manager's own location search returns a "Lugar"/Place category
  // (landmarks, colonias, points of interest) alongside "city" — that's
  // the granularity a colonia like "Cuajimalpa de Morelos" actually
  // needs, and it was missing from location_types entirely. Try it
  // first; if Meta rejects "place" as invalid in this API version (the
  // same failure mode "neighborhood" caused before), fall back to the
  // known-good city/zip-only list instead of the whole search breaking.
  let res = await graphRequest<LocationSearchData>(
    "/search",
    config.accessToken,
    {
      type: "adgeolocation",
      q: query,
      location_types: ["city", "zip", "place"],
      country_code: countryCode,
      limit: 8,
    },
    "GET",
  );
  if (!res.ok) {
    res = await graphRequest<LocationSearchData>(
      "/search",
      config.accessToken,
      {
        type: "adgeolocation",
        q: query,
        location_types: ["city", "zip"],
        country_code: countryCode,
        limit: 8,
      },
      "GET",
    );
  }
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res.data.data.map((r) => ({
      key: r.key,
      name: r.name,
      type: r.type,
      region: r.region ?? null,
    })),
  };
}

export type InterestSuggestion = { id: string; name: string; audienceSize: number | null };

export async function searchMetaInterests(
  query: string,
): Promise<{ ok: true; data: InterestSuggestion[] } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };
  const res = await graphRequest<{
    data: Array<{ id?: string | number; name: string; audience_size_lower_bound?: number }>;
  }>("/search", config.accessToken, { type: "adinterest", q: query, limit: 10 }, "GET");
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    // String(r.id) + the filter below is what actually made
    // "interestIds: Invalid input" happen on real submissions: whatever
    // Meta returned here got stored and sent back verbatim, and if it was
    // ever a bare number (JSON int, not a quoted string) or missing, it
    // sailed past every type here (nothing enforces it at runtime) and
    // only broke much later, at the zod check in campaigns-create.ts.
    data: res.data.data
      .filter((r) => r.id != null && String(r.id).length > 0)
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        audienceSize: r.audience_size_lower_bound ?? null,
      })),
  };
}

// The same "sugerencias" Meta's own Ads Manager shows right after you add
// an interest — takes the interests already picked and returns related
// ones, so the client doesn't have to guess synonyms (e.g. picking
// "Negocios" surfaces "Emprendimiento", "Pequeña empresa", etc. on its
// own). Note this endpoint takes interest *names*, not IDs.
export async function suggestMetaInterests(
  interestNames: string[],
): Promise<{ ok: true; data: InterestSuggestion[] } | { ok: false; error: string }> {
  const config = getMetaConfig();
  if ("error" in config) return { ok: false, error: config.error };
  const res = await graphRequest<{
    data: Array<{ id?: string | number; name: string; audience_size_lower_bound?: number }>;
  }>(
    "/search",
    config.accessToken,
    { type: "adinterestsuggestion", interest_list: interestNames, limit: 10 },
    "GET",
  );
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: res.data.data
      .filter((r) => r.id != null && String(r.id).length > 0)
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        audienceSize: r.audience_size_lower_bound ?? null,
      })),
  };
}

// ---------- campaign creation ----------

export type CampaignObjective = "trafico" | "interaccion" | "ventas";

// Maps our 3 client-facing objectives to Meta's real ODAX objective +
// optimization goal. "Ventas" deliberately does NOT use Meta's official
// Click-to-WhatsApp ad type (destination_type: WHATSAPP) — that requires
// the client to verify their WhatsApp number with Meta first (an OTP sent
// to their own phone, which we can't do on their behalf). Instead it's a
// plain link-click campaign pointed at a wa.me link, same practical result
// (clicking the ad opens a WhatsApp chat) with zero extra setup per client.
function resolveObjective(objective: CampaignObjective): {
  metaObjective: string;
  optimizationGoal: string;
} {
  switch (objective) {
    case "trafico":
    case "ventas":
      return { metaObjective: "OUTCOME_TRAFFIC", optimizationGoal: "LINK_CLICKS" };
    case "interaccion":
      return { metaObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "POST_ENGAGEMENT" };
  }
}

function resolveDestinationLink(
  objective: CampaignObjective,
  pageId: string,
  whatsappNumber: string | null,
  websiteUrl: string | null,
): string {
  if (objective === "ventas" && whatsappNumber) {
    const digits = whatsappNumber.replace(/[^\d]/g, "");
    return `https://wa.me/${digits}`;
  }
  // "Tráfico" can go to the client's own website when they have one —
  // falls back to their Facebook Page (their "redes") otherwise, same as
  // every other objective.
  if (objective === "trafico" && websiteUrl) return websiteUrl;
  return `https://www.facebook.com/${pageId}`;
}

export type CreatePausedCampaignInput = {
  // Numeric id without the act_ prefix, selected by the client during the
  // dedicated advertising-account OAuth flow.
  adAccountId: string;
  // Encrypted-at-rest user OAuth token decrypted by the API route. Admin-
  // configured legacy accounts can omit it and use META_ACCESS_TOKEN.
  accessToken?: string;
  requestTitle: string;
  objective: CampaignObjective;
  dailyBudgetCents: number;
  // How many days the ad set should run before it auto-stops.
  durationDays: number;
  imageBytesBase64: string;
  imageContentType: string;
  // 1-3 ad copy variants — all included as text options on a single paused
  // ad (Meta's own "multiple text options" template, the same one Ads
  // Manager offers when you add several variations to one ad), which
  // rotates/tests between them automatically. This is deliberately ONE ad,
  // not one ad per variant — three separate ads for what's visually the
  // same creative read as confusing/illogical to the client.
  adMessages: string[];
  ageMin: number;
  ageMax: number;
  // Meta's own city/neighborhood/zip search result key (see
  // searchMetaLocations) — null falls back to all of Mexico. Mutually
  // exclusive with customLocation below; if both are somehow set,
  // customLocation wins (see geoLocations resolution).
  locationKey: string | null;
  radiusKm: number | null;
  // A raw lat/lon the client dropped a pin on — Meta's "custom location"
  // targeting (the same thing Ads Manager offers when you place a pin by
  // hand), for places that don't exist as a searchable named entity in
  // Meta's own location database (boroughs/colonias are hit-or-miss there).
  customLocation: { lat: number; lon: number } | null;
  interestIds: string[];
  // The client's own connected Facebook Page (brand_profiles.meta_page_id)
  // — required. Callers must confirm it's set before calling this at all;
  // see /api/campaigns-create's "pagina_no_conectada" check.
  pageId: string;
  // Required only when objective === "ventas".
  whatsappNumber: string | null;
  // Optional, only used when objective === "trafico" — the client's own
  // site. Null/omitted falls back to their Facebook Page as the destination.
  websiteUrl: string | null;
};

export type CreatePausedCampaignResult =
  | {
      ok: true;
      campaignId: string;
      adsetId: string;
      // 0 or 1 entries — kept as an array for DB/bookkeeping compatibility,
      // but this is always a single ad now.
      adIds: string[];
      // Set when everything up to the ad set worked but the ad itself
      // couldn't be created — the campaign/ad set still exist and are
      // visible in Ads Manager.
      warning?: string;
    }
  | { ok: false; error: string };

// Orchestrates campaign → ad set → image upload → one ad per copy variant,
// all created with status PAUSED. The caller has already confirmed the
// client has a connected Page (input.pageId) and, for "ventas", a WhatsApp
// number, so once the ad set succeeds this runs straight through.
export async function createPausedCampaignForRequest(
  input: CreatePausedCampaignInput,
): Promise<CreatePausedCampaignResult> {
  const config = input.accessToken ? null : getMetaConfig();
  if (config && "error" in config) return { ok: false, error: config.error };
  const accessToken =
    input.accessToken ?? (config && "accessToken" in config ? config.accessToken : "");
  const { adAccountId } = input;
  const { pageId, objective } = input;
  const act = `act_${adAccountId}`;
  const { metaObjective, optimizationGoal } = resolveObjective(objective);

  const campaign = await graphRequest<{ id: string }>(`/${act}/campaigns`, accessToken, {
    name: `WITERS — ${input.requestTitle}`,
    objective: metaObjective,
    status: "PAUSED",
    special_ad_categories: [],
    // Budget + bid strategy live on the campaign (CBO), not the ad set —
    // one number to manage per campaign, matching what the client expects
    // to see. Each campaign only ever has one ad set here, so CBO vs ABO
    // makes no practical delivery difference, but it's what avoids the
    // "is_adset_budget_sharing_enabled" field Meta only requires when the
    // ad set (not the campaign) carries the budget.
    daily_budget: input.dailyBudgetCents,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  });
  if (!campaign.ok) return { ok: false, error: campaign.error };
  const campaignId = campaign.data.id;

  const now = new Date();
  const endTime = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
  const geoLocations =
    input.customLocation && input.radiusKm
      ? {
          custom_locations: [
            {
              latitude: input.customLocation.lat,
              longitude: input.customLocation.lon,
              radius: input.radiusKm,
              distance_unit: "kilometer",
            },
          ],
        }
      : input.locationKey && input.radiusKm
        ? {
            cities: [
              { key: input.locationKey, radius: input.radiusKm, distance_unit: "kilometer" },
            ],
          }
        : { countries: ["MX"] };

  function buildAdsetPayload(includeInterests: boolean) {
    return {
      name: `WITERS — ${input.requestTitle}`,
      campaign_id: campaignId,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
      billing_event: "IMPRESSIONS",
      optimization_goal: optimizationGoal,
      // Required whenever optimization_goal is POST_ENGAGEMENT — it needs to
      // know which Page's post it's optimizing engagement for. Omitting this
      // for "interacción" campaigns is what used to fail with "Invalid
      // parameter" on every real attempt.
      ...(objective === "interaccion" ? { promoted_object: { page_id: pageId } } : {}),
      targeting: {
        // Deliberately left on Meta's automatic placements (Facebook +
        // Instagram + the rest) rather than restricted to Facebook only —
        // no client has an Instagram account explicitly connected here, but
        // Instagram delivery is still wanted to see how it performs in
        // practice for Pages that do have one linked in Meta's own system.
        geo_locations: geoLocations,
        age_min: input.ageMin,
        age_max: input.ageMax,
        ...(includeInterests && input.interestIds.length
          ? { flexible_spec: [{ interests: input.interestIds.map((id) => ({ id })) }] }
          : {}),
      },
      status: "PAUSED",
    };
  }

  let adset = await graphRequest<{ id: string }>(
    `/${act}/adsets`,
    accessToken,
    buildAdsetPayload(true),
  );
  // A real campaign hit this: one interest id Meta's search/suggestion
  // endpoints handed back turned out to not be valid for targeting
  // ("Los intereses con el identificador ... no son válidos"), which
  // fails the whole ad set even though everything else about it was
  // fine. Rather than leave the client stuck, retry once with broader
  // (no-interest) targeting instead of losing the campaign entirely —
  // surfaced via the warning below so it's never silent.
  let droppedInterests = false;
  if (!adset.ok && input.interestIds.length && /inter[ée]s/i.test(adset.error)) {
    droppedInterests = true;
    adset = await graphRequest<{ id: string }>(
      `/${act}/adsets`,
      accessToken,
      buildAdsetPayload(false),
    );
  }
  if (!adset.ok) {
    return {
      ok: true,
      campaignId,
      adsetId: "",
      adIds: [],
      warning: `La campaña se creó, pero el conjunto de anuncios falló: ${adset.error}`,
    };
  }
  const interestNote = droppedInterests
    ? "Quitamos la segmentación por intereses porque uno de los identificadores ya no era válido para Meta — la campaña llegó a todo el público en el rango de edad/ubicación elegido en su lugar. "
    : "";

  const imageUpload = await graphRequest<{ images: Record<string, { hash: string }> }>(
    `/${act}/adimages`,
    accessToken,
    { bytes: input.imageBytesBase64 },
  );
  if (!imageUpload.ok) {
    return {
      ok: true,
      campaignId,
      adsetId: adset.data.id,
      adIds: [],
      warning: `${interestNote}La campaña y el conjunto de anuncios se crearon, pero no pudimos subir la imagen: ${imageUpload.error}`,
    };
  }
  const imageHash = Object.values(imageUpload.data.images)[0]?.hash;
  if (!imageHash) {
    return {
      ok: true,
      campaignId,
      adsetId: adset.data.id,
      adIds: [],
      warning: `${interestNote}La campaña y el conjunto de anuncios se crearon, pero la imagen no se pudo procesar.`,
    };
  }

  const link = resolveDestinationLink(objective, pageId, input.whatsappNumber, input.websiteUrl);

  // A single ad whose creative carries all copy variants as text options —
  // Meta's own "plantilla de mensajes" (the same multiple-text-variations
  // feature Ads Manager offers on one ad), which rotates/tests between them
  // on its own. Tried first; if this ad account/API version rejects
  // asset_feed_spec, fall back to one plain ad with just the first variant
  // rather than failing the whole campaign over it.
  let creative = await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
    name: `WITERS — ${input.requestTitle}`,
    object_story_spec: { page_id: pageId },
    asset_feed_spec: {
      images: [{ hash: imageHash }],
      bodies: input.adMessages.map((text) => ({ text })),
      link_urls: [{ website_url: link }],
      call_to_action_types: ["LEARN_MORE"],
      ad_formats: ["SINGLE_IMAGE"],
    },
  });
  if (!creative.ok) {
    creative = await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
      name: `WITERS — ${input.requestTitle}`,
      object_story_spec: {
        page_id: pageId,
        link_data: { image_hash: imageHash, message: input.adMessages[0], link },
      },
    });
  }
  if (!creative.ok) {
    return {
      ok: true,
      campaignId,
      adsetId: adset.data.id,
      adIds: [],
      warning: `${interestNote}La campaña y el conjunto de anuncios se crearon, pero el anuncio no se pudo generar: ${creative.error}`,
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
      campaignId,
      adsetId: adset.data.id,
      adIds: [],
      warning: `${interestNote}La campaña y el conjunto de anuncios se crearon, pero el anuncio no se pudo generar: ${ad.error}`,
    };
  }

  return {
    ok: true,
    campaignId,
    adsetId: adset.data.id,
    adIds: [ad.data.id],
    warning: droppedInterests ? interestNote.trim() : undefined,
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
