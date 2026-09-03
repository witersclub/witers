// Talks to Meta's Marketing API (Graph API) to turn a finished WITERS piece
// into a real (but paused, never auto-activated) ad campaign — the "Pauta
// interactiva" screen in panel.tsx. Uses a Business Portfolio System User
// token (META_ACCESS_TOKEN), not per-client OAuth. Every campaign is
// created in the ad account explicitly connected to the current brand.
// The Facebook Page, unlike the ad account, is per-client (each client's
// ads must publish from their own Page) — callers pass it in explicitly
// from that client's brand_profiles.meta_page_id, never from env config.

import process from "node:process";

import {
  META_GRAPH_BASE as GRAPH_BASE,
  META_GRAPH_VERSION as GRAPH_VERSION,
} from "./meta-graph-version.server";
import { digitsOnly } from "./meta-whatsapp.server";

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

// Where a "trafico" ad sends people — Meta's own destination_type family
// for a visits objective. "website" is its own category; Meta has no
// value combining it with a Page/profile destination, only a combined
// value for the two profiles together (both_profiles).
export type MetaTrafficDestination =
  "website" | "facebook_page" | "instagram_profile" | "both_profiles";

// Which inbox(es) a messaging ad ("interaccion" or "ventas" — both are
// pure messaging destinations now, see resolveObjective) can open. A
// client can pick any non-empty combination of the 3.
export type MetaMessagingChannel = "whatsapp" | "messenger" | "instagram_direct";

// Maps our 3 client-facing objectives to Meta's real ODAX objective +
// optimization goal. "Interacción" and "Ventas" are BOTH messaging
// destinations now (destination_type below) — Meta's own "Interacción"
// objective's "Mensajes" conversion location and its "Ventas" objective's
// "Mensajes" conversion location are the same underlying mechanism, just
// framed differently for the client; there's no separate post-engagement
// mode here anymore. optimization_goal is IMPRESSIONS rather than the
// ideal CONVERSATIONS because CONVERSATIONS isn't available for numbers
// hosted on WhatsApp's own Cloud API (the common case today) — the same
// fallback Meta's own reference payload for this ad type uses.
function resolveObjective(objective: CampaignObjective): {
  metaObjective: string;
  optimizationGoal: string;
} {
  switch (objective) {
    case "trafico":
      return { metaObjective: "OUTCOME_TRAFFIC", optimizationGoal: "LINK_CLICKS" };
    case "ventas":
    case "interaccion":
      return { metaObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "IMPRESSIONS" };
  }
}

// Meta's exact destination_type values for a messaging ad set — verified
// against Meta's own Marketing API Python SDK (facebook/facebook-python-
// business-sdk, adobjects/adset.py, the DestinationType class), not
// invented. There's no generic "pick several" flag; each combination of
// the 3 channels is its own literal enum value.
export function resolveMessagingDestinationType(channels: MetaMessagingChannel[]): string {
  const whatsapp = channels.includes("whatsapp");
  const messenger = channels.includes("messenger");
  const instagram = channels.includes("instagram_direct");
  if (whatsapp && messenger && instagram) return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
  if (instagram && messenger) return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER";
  if (instagram && whatsapp) return "MESSAGING_INSTAGRAM_DIRECT_WHATSAPP";
  if (messenger && whatsapp) return "MESSAGING_MESSENGER_WHATSAPP";
  if (instagram) return "INSTAGRAM_DIRECT";
  if (messenger) return "MESSENGER";
  return "WHATSAPP";
}

// Same idea for "trafico" — verified from the same SDK source.
function resolveTrafficDestinationType(destination: MetaTrafficDestination): string {
  switch (destination) {
    case "website":
      return "WEBSITE";
    case "facebook_page":
      return "FACEBOOK_PAGE";
    case "instagram_profile":
      return "INSTAGRAM_PROFILE";
    case "both_profiles":
      return "INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE";
  }
}

function resolveDestinationLink(
  objective: CampaignObjective,
  pageId: string,
  trafficDestination: MetaTrafficDestination | null,
  websiteUrl: string | null,
): string {
  // Real messaging-destination ads still need a link_data.link value even
  // though Meta resolves the actual destination from destination_type +
  // promoted_object, not from this URL — this exact placeholder is the
  // one Meta's own Click-to-WhatsApp reference payload uses in that field,
  // reused here for every messaging channel since none of them route off
  // this link either.
  if (objective === "ventas" || objective === "interaccion") return "https://api.whatsapp.com/send";
  if (trafficDestination === "website" && websiteUrl) return websiteUrl;
  // Page/profile destinations don't route off this link either (the
  // creative's page_id/instagram_actor_id do that) — same harmless
  // placeholder pattern.
  return `https://www.facebook.com/${pageId}`;
}

// Resolves the Instagram professional account linked to the client's own
// connected Facebook Page — the id Meta's ad creative needs as
// instagram_actor_id for any Instagram-attributed ad (profile visits or
// Instagram Direct messaging). A long-standing, standard Graph API field,
// not part of the newer WhatsApp/messaging-destination surface.
async function resolveInstagramActorId(
  pageId: string,
  accessToken: string,
): Promise<string | null> {
  const res = await graphRequest<{ instagram_business_account?: { id: string } }>(
    `/${pageId}`,
    accessToken,
    { fields: "instagram_business_account" },
    "GET",
  );
  if (!res.ok) return null;
  return res.data.instagram_business_account?.id ?? null;
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
  // Images use Meta's /adimages endpoint. Video uploads remain streaming
  // from R2 so a final cut never has to be base64 encoded in Worker memory.
  media:
    | { kind: "image"; bytesBase64: string; contentType: string }
    | {
        kind: "video";
        // R2's stream type is supplied by Workers and is intentionally kept
        // unparameterized here so it can be passed through without copying.
        body: ReadableStream;
        size: number;
        contentType: string;
      };
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
  // Required only when objective === "trafico".
  trafficDestination: MetaTrafficDestination | null;
  // Required (non-empty) when objective is "interaccion" or "ventas".
  messagingChannels: MetaMessagingChannel[];
  // Required only when messagingChannels includes "whatsapp".
  whatsappNumber: string | null;
  // Optional, only used when trafficDestination === "website". Null/omitted
  // falls back to their Facebook Page as the destination.
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

type UploadedAdVideo = { id: string; stillProcessing: boolean };

// Start a Marketing API video session, then stream R2 directly to Meta's
// resumable-upload host. This prevents a multi-hundred-MB final cut from
// exhausting Worker memory before an ad is even created.
async function uploadAdVideo(
  adAccountId: string,
  accessToken: string,
  video: Extract<CreatePausedCampaignInput["media"], { kind: "video" }>,
): Promise<{ ok: true; data: UploadedAdVideo } | { ok: false; error: string }> {
  const act = `act_${adAccountId}`;
  const start = await graphRequest<{ video_id?: string; id?: string; upload_url?: string }>(
    `/${act}/advideos`,
    accessToken,
    { upload_phase: "start", file_size: String(video.size) },
  );
  if (!start.ok) return start;

  const videoId = start.data.video_id ?? start.data.id;
  if (!videoId) return { ok: false, error: "Meta no devolvió el identificador del video." };
  const suppliedUrl = start.data.upload_url;
  const uploadUrl =
    suppliedUrl && /^https:\/\/rupload\.facebook\.com\//.test(suppliedUrl)
      ? suppliedUrl
      : `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let upload: Response;
  try {
    upload = await fetch(uploadUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `OAuth ${accessToken}`,
        offset: "0",
        file_size: String(video.size),
        "content-type": "application/octet-stream",
      },
      body: video.body as unknown as BodyInit,
    });
  } catch {
    return { ok: false, error: "La carga del video a Meta tardó demasiado." };
  } finally {
    clearTimeout(timer);
  }
  if (!upload.ok) {
    const raw = await upload.text().catch(() => "");
    let detail = "";
    try {
      const body = JSON.parse(raw) as GraphError;
      detail = body.error?.error_user_msg ?? body.error?.message ?? "";
    } catch {
      // rupload may answer in plain text/HTML; do not expose it to clients.
    }
    return { ok: false, error: detail || "Meta no pudo recibir el video." };
  }

  // Encoding is asynchronous. Check briefly for the common fast case, but
  // do not hold the client request indefinitely for a large final cut.
  for (let attempt = 0; attempt < 4; attempt++) {
    const status = await graphRequest<{ status?: unknown }>(
      `/${videoId}`,
      accessToken,
      { fields: "status" },
      "GET",
    );
    if (!status.ok) break;
    const state = JSON.stringify(status.data.status ?? "").toLowerCase();
    if (/(error|failed|expired)/.test(state)) {
      return { ok: false, error: "Meta no pudo procesar el video." };
    }
    if (/(ready|complete|finished)/.test(state)) {
      return { ok: true, data: { id: videoId, stillProcessing: false } };
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { ok: true, data: { id: videoId, stillProcessing: true } };
}

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

  if (objective === "trafico" && !input.trafficDestination) {
    return { ok: false, error: "falta_destino_trafico" };
  }
  if ((objective === "interaccion" || objective === "ventas") && !input.messagingChannels.length) {
    return { ok: false, error: "falta_canal_mensajeria" };
  }
  // Resolved once, before creating anything — a missing Instagram
  // connection should stop the whole request, not leave a paused
  // campaign/ad set behind that can never actually deliver to Instagram.
  const needsInstagram =
    input.trafficDestination === "instagram_profile" ||
    input.trafficDestination === "both_profiles" ||
    input.messagingChannels.includes("instagram_direct");
  const instagramActorId = needsInstagram
    ? await resolveInstagramActorId(pageId, accessToken)
    : null;
  if (needsInstagram && !instagramActorId) {
    return { ok: false, error: "instagram_no_conectado" };
  }

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

  // Meta's promoted_object.whatsapp_phone_number takes plain digits, not
  // the phoneNumberId or Meta's spaced/parenthesized display format — same
  // digit-stripping already used to build the destination for reporting.
  const whatsappDigits = input.whatsappNumber ? digitsOnly(input.whatsappNumber) : null;

  function buildAdsetPayload(includeInterests: boolean) {
    return {
      name: `WITERS — ${input.requestTitle}`,
      campaign_id: campaignId,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
      billing_event: "IMPRESSIONS",
      optimization_goal: optimizationGoal,
      // "Interacción" and "Ventas" are both messaging destinations now:
      // destination_type tells Meta which inbox(es) the ad opens, and
      // promoted_object carries the Page (always) plus the WhatsApp number
      // (only when WhatsApp is one of the chosen channels) — both fields
      // are Meta's own documented shape for this ad type, not invented.
      ...(objective === "interaccion" || objective === "ventas"
        ? {
            destination_type: resolveMessagingDestinationType(input.messagingChannels),
            promoted_object: {
              page_id: pageId,
              ...(input.messagingChannels.includes("whatsapp")
                ? { whatsapp_phone_number: whatsappDigits }
                : {}),
            },
          }
        : {}),
      // "Tráfico": destination_type says which surface the ad sends people
      // to (website / Facebook Page / Instagram profile / both profiles) —
      // no promoted_object needed here, same as before this feature (the
      // creative's own page_id/instagram_actor_id carry that instead).
      ...(objective === "trafico" && input.trafficDestination
        ? { destination_type: resolveTrafficDestinationType(input.trafficDestination) }
        : {}),
      targeting: {
        // Deliberately left on Meta's automatic placements (Facebook +
        // Instagram + the rest) rather than restricted to Facebook only —
        // this is about which ad SURFACES can show the ad, separate from
        // destination_type above (which inbox/page it opens once tapped).
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

  const link = resolveDestinationLink(
    objective,
    pageId,
    input.trafficDestination,
    input.websiteUrl,
  );
  // WHATSAPP_MESSAGE + app_destination is the one call-to-action shape
  // verified against Meta's own Click-to-WhatsApp reference payload — used
  // as-is when WhatsApp is the only chosen channel. For every other
  // messaging combination (Messenger, Instagram Direct, or any mix without
  // an exact WhatsApp-only match) this falls back to MESSAGE_PAGE, Meta's
  // long-standing generic "send message" call-to-action — actual routing
  // to the right inbox(es) is controlled by destination_type on the ad set
  // above, not by this button, so a generic CTA here is a safe default
  // rather than a guessed channel-specific one.
  const isWhatsAppOnly =
    input.messagingChannels.length === 1 && input.messagingChannels[0] === "whatsapp";
  const messagingCallToAction = isWhatsAppOnly
    ? { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } }
    : { type: "MESSAGE_PAGE" };

  if (input.media.kind === "video") {
    const videoUpload = await uploadAdVideo(adAccountId, accessToken, input.media);
    if (!videoUpload.ok) {
      return {
        ok: true,
        campaignId,
        adsetId: adset.data.id,
        adIds: [],
        warning: `${interestNote}La campaña y el conjunto de anuncios se crearon, pero no pudimos subir el video: ${videoUpload.error}`,
      };
    }
    const processingNote = videoUpload.data.stillProcessing
      ? "Meta continúa procesando el video; el anuncio seguirá en pausa hasta que esté listo. "
      : "";
    const videoCreative = await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
      name: `WITERS — ${input.requestTitle}`,
      object_story_spec: {
        page_id: pageId,
        ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
        video_data: {
          video_id: videoUpload.data.id,
          message: input.adMessages[0],
          call_to_action:
            objective === "ventas" || objective === "interaccion"
              ? messagingCallToAction
              : { type: "LEARN_MORE", value: { link } },
        },
      },
    });
    if (!videoCreative.ok) {
      return {
        ok: true,
        campaignId,
        adsetId: adset.data.id,
        adIds: [],
        warning: `${interestNote}${processingNote}La campaña y el conjunto de anuncios se crearon, pero el anuncio de video no se pudo generar: ${videoCreative.error}`,
      };
    }
    const videoAd = await graphRequest<{ id: string }>(`/${act}/ads`, accessToken, {
      name: `WITERS — ${input.requestTitle}`,
      adset_id: adset.data.id,
      creative: { creative_id: videoCreative.data.id },
      status: "PAUSED",
    });
    if (!videoAd.ok) {
      return {
        ok: true,
        campaignId,
        adsetId: adset.data.id,
        adIds: [],
        warning: `${interestNote}${processingNote}La campaña y el conjunto de anuncios se crearon, pero el anuncio de video no se pudo generar: ${videoAd.error}`,
      };
    }
    return {
      ok: true,
      campaignId,
      adsetId: adset.data.id,
      adIds: [videoAd.data.id],
      warning:
        droppedInterests || processingNote ? `${interestNote}${processingNote}`.trim() : undefined,
    };
  }

  const imageUpload = await graphRequest<{ images: Record<string, { hash: string }> }>(
    `/${act}/adimages`,
    accessToken,
    { bytes: input.media.bytesBase64 },
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

  const isMessaging = objective === "ventas" || objective === "interaccion";
  // Messaging objectives go straight to a single plain link_data creative
  // with the messaging call-to-action — Meta's asset_feed_spec (the
  // multi-variant template used below for "trafico") pairs
  // call_to_action_types with a plain link_urls destination, and there's
  // no verified reference showing it also supports a messaging/app
  // destination the same way; rather than guess at an unverified
  // combination, this uses only the exact shape Meta documents for
  // Click-to-WhatsApp, at the cost of losing the multi-copy-variant
  // rotation "trafico" ads get.
  let creative = isMessaging
    ? await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
        name: `WITERS — ${input.requestTitle}`,
        object_story_spec: {
          page_id: pageId,
          ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
          link_data: {
            image_hash: imageHash,
            message: input.adMessages[0],
            link,
            call_to_action: messagingCallToAction,
          },
        },
      })
    : // A single ad whose creative carries all copy variants as text
      // options — Meta's own "plantilla de mensajes" (the same
      // multiple-text-variations feature Ads Manager offers on one ad),
      // which rotates/tests between them on its own. Tried first; if
      // this ad account/API version rejects asset_feed_spec, fall back
      // to one plain ad with just the first variant rather than failing
      // the whole campaign over it.
      await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
        name: `WITERS — ${input.requestTitle}`,
        object_story_spec: {
          page_id: pageId,
          ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
        },
        asset_feed_spec: {
          images: [{ hash: imageHash }],
          bodies: input.adMessages.map((text) => ({ text })),
          link_urls: [{ website_url: link }],
          call_to_action_types: ["LEARN_MORE"],
          ad_formats: ["SINGLE_IMAGE"],
        },
      });
  if (!creative.ok && !isMessaging) {
    creative = await graphRequest<{ id: string }>(`/${act}/adcreatives`, accessToken, {
      name: `WITERS — ${input.requestTitle}`,
      object_story_spec: {
        page_id: pageId,
        ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
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
