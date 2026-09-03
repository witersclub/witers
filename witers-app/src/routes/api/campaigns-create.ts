import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Buffer } from "node:buffer";

import { bindings } from "../../lib/bindings.server";
import { getBrandProfile } from "../../lib/brand-profile.server";
import { getMetaAdOAuthAccessToken } from "../../lib/meta-ad-account-connection.server";
import { createPausedCampaignForRequest } from "../../lib/meta-ads-create.server";
import { digitsOnly, listMetaWhatsAppNumbers } from "../../lib/meta-whatsapp.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z
  .object({
    requestId: z.string().min(1),
    // One per opened "Pautar" sheet (see campaign-creation-sheet.tsx) —
    // the real idempotency guard below is keyed on this, not on timing.
    idempotencyKey: z.string().uuid(),
    // The calendar owns the piece format. We still re-check the matching
    // request below, so this value only selects the appropriate existing
    // request model; it never grants access to another user's content.
    format: z.enum(["imagen", "video"]),
    objective: z.enum(["trafico", "interaccion", "ventas"]),
    // Pesos MXN per day (whole or with cents), converted to centavos below
    // — matches how prices already read elsewhere in the app.
    dailyBudgetMxn: z.number().min(20).max(50_000),
    durationDays: z.number().int().min(1).max(90),
    ageMin: z.number().int().min(13).max(65),
    ageMax: z.number().int().min(13).max(65),
    // A Meta location-search result key (see /api/meta-location-search) —
    // omitted means "all of Mexico," same as before this feature.
    locationKey: z.string().min(1).optional(),
    // A hand-dropped pin (lat/lon) — for places that aren't searchable as
    // a named entity in Meta's own location database (colonias/boroughs
    // are hit-or-miss there). Takes priority over locationKey if both are
    // somehow present.
    customLat: z.number().min(-90).max(90).optional(),
    customLon: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(5).max(50).optional(),
    interestIds: z.array(z.string().min(1)).max(10).default([]),
    adMessages: z.array(z.string().min(1).max(500)).min(1).max(3),
    // Required only when objective === "trafico" — which surface the ad
    // sends people to. Meta's own destination_type family for this
    // objective (see resolveTrafficDestinationType in meta-ads-create).
    trafficDestination: z
      .enum(["website", "facebook_page", "instagram_profile", "both_profiles"])
      .optional(),
    // Required (non-empty) when objective is "interaccion" or "ventas" —
    // which inbox(es) the ad opens. Any combination Meta's own
    // destination_type enum supports (see resolveMessagingDestinationType).
    messagingChannels: z
      .array(z.enum(["whatsapp", "messenger", "instagram_direct"]))
      .max(3)
      .default([]),
    // Required only when messagingChannels includes "whatsapp" — chosen
    // from the client's own real, connected WhatsApp Business numbers (see
    // meta-whatsapp.server.ts). Re-verified against Meta below rather than
    // trusted as-is; optionally saved as brand_profiles.default_whatsapp_number
    // separately, via /api/meta/whatsapp/default.
    whatsappNumber: z.string().min(6).max(40).optional(),
    // Optional, only meaningful when trafficDestination === "website" —
    // omitted means the ad points to the client's Facebook Page instead.
    websiteUrl: z.string().url().max(300).optional(),
  })
  .refine((v) => v.ageMin <= v.ageMax, { message: "rango_edad_invalido" })
  .refine((v) => v.objective !== "trafico" || Boolean(v.trafficDestination), {
    message: "falta_destino_trafico",
  })
  .refine(
    (v) =>
      (v.objective !== "interaccion" && v.objective !== "ventas") || v.messagingChannels.length > 0,
    { message: "falta_canal_mensajeria" },
  )
  .refine((v) => !v.messagingChannels.includes("whatsapp") || Boolean(v.whatsappNumber), {
    message: "falta_whatsapp",
  });

type RequestRow = { id: string; user_id: string; title: string; status: string };
type ResultRow = { r2_key: string | null; image_url: string | null };
type VideoRequestRow = RequestRow & { delivered_key: string | null };
type FacebookConnectionRow = { page_id: string | null };

// "datos_invalidos" alone doesn't say which field or why — this is what
// left a real submission failure ("No pudimos crear la campaña
// (datos_invalidos)") impossible to diagnose from a screenshot. Same
// pattern as /api/requests.ts's describeValidationError.
function describeValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Revisa los datos de la campaña e intenta de nuevo.";
  const field = String(issue.path[0] ?? "campo desconocido");
  return `${field}: ${issue.message}`;
}

// Turns a finished piece into a real (paused) Meta campaign — the "Pauta
// interactiva" screen in panel.tsx. Never activates anything; the client
// reviews and turns it on later from Ads Manager (or from Campañas, once
// that's wired to do more than show status).
export const Route = createFileRoute("/api/campaigns-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json(
            { ok: false, error: "datos_invalidos", message: describeValidationError(parsed.error) },
            { status: 400 },
          );
        }

        const reqRow =
          parsed.data.format === "video"
            ? await db()
                .prepare(
                  "SELECT id, user_id, title, status, delivered_key FROM video_requests WHERE id = ?1",
                )
                .bind(parsed.data.requestId)
                .first<VideoRequestRow>()
            : await db()
                .prepare("SELECT id, user_id, title, status FROM design_requests WHERE id = ?1")
                .bind(parsed.data.requestId)
                .first<RequestRow>();
        if (!reqRow || reqRow.user_id !== user.id) {
          return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        }
        if (
          (parsed.data.format === "video" && reqRow.status !== "completada") ||
          (parsed.data.format === "imagen" &&
            reqRow.status !== "completada" &&
            reqRow.status !== "cerrada")
        ) {
          return json({ ok: false, error: "solicitud_no_terminada" }, { status: 409 });
        }
        // No shared/default Page: each client pautas from their own,
        // set only by an admin once it's connected to WITERS's Business
        // Manager (see /api/admin/update-brand-profile).
        const brandProfile = await getBrandProfile(user.id);
        const facebookConnection = !brandProfile?.meta_page_id
          ? await db()
              .prepare(
                "SELECT page_id FROM social_connections WHERE user_id = ?1 AND platform = 'facebook' LIMIT 1",
              )
              .bind(user.id)
              .first<FacebookConnectionRow>()
          : null;
        const pageId = brandProfile?.meta_page_id ?? facebookConnection?.page_id ?? null;
        if (!pageId) {
          return json({ ok: false, error: "pagina_no_conectada" }, { status: 409 });
        }
        const adAccountId = brandProfile?.meta_ad_account_id ?? null;
        if (!adAccountId) {
          return json({ ok: false, error: "cuenta_publicitaria_no_conectada" }, { status: 409 });
        }
        const oauthAccessToken =
          (await getMetaAdOAuthAccessToken(user.id, adAccountId)) ?? undefined;

        // A WhatsApp-inclusive messaging channel needs a real WhatsApp
        // destination — re-verify it against this session's own connected
        // Meta login server-side rather than trusting whatever digits the
        // client sent (a stale/foreign/typo'd number would otherwise
        // silently build an invalid campaign).
        if (parsed.data.messagingChannels.includes("whatsapp")) {
          if (!oauthAccessToken) {
            return json({ ok: false, error: "whatsapp_no_conectado" }, { status: 409 });
          }
          const submittedDigits = digitsOnly(parsed.data.whatsappNumber ?? "");
          const numbers = await listMetaWhatsAppNumbers(oauthAccessToken);
          const match =
            numbers.ok &&
            numbers.numbers.some((n) => digitsOnly(n.displayNumber) === submittedDigits);
          if (!match) {
            return json({ ok: false, error: "whatsapp_no_disponible" }, { status: 409 });
          }
        }

        const resultRow =
          parsed.data.format === "imagen"
            ? await db()
                .prepare(
                  `SELECT r2_key, image_url FROM request_results
                   WHERE request_id = ?1 AND kind != 'draft'
                   ORDER BY created_at DESC LIMIT 1`,
                )
                .bind(reqRow.id)
                .first<ResultRow>()
            : null;
        const mediaKey =
          parsed.data.format === "video"
            ? (reqRow as VideoRequestRow).delivered_key
            : resultRow?.r2_key;
        if (!mediaKey) {
          return json({ ok: false, error: "sin_pieza_final" }, { status: 409 });
        }

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });
        const obj = await STORAGE.get(mediaKey);
        if (!obj) return json({ ok: false, error: "archivo_no_encontrado" }, { status: 404 });
        const contentType = obj.httpMetadata?.contentType ?? "application/octet-stream";
        const media =
          parsed.data.format === "video"
            ? {
                kind: "video" as const,
                // Keep the final cut streaming from R2 to Meta. Videos can
                // be hundreds of MB, so arrayBuffer()/base64 would exceed a
                // Worker memory limit before the upload even begins.
                // R2's Workers stream and the DOM stream declaration use
                // slightly different `read()` typings, while both are the
                // same runtime stream accepted by fetch in this Worker.
                body: obj.body as unknown as ReadableStream,
                size: obj.size,
                contentType,
              }
            : {
                kind: "image" as const,
                // Spreading a large Uint8Array into String.fromCharCode(...)
                // blows the call stack for real design files. Buffer handles
                // the conversion safely for the image endpoint.
                bytesBase64: Buffer.from(await obj.arrayBuffer()).toString("base64"),
                contentType,
              };

        // Real idempotency guard: reserve a row under this exact key right
        // before touching Meta at all — everything above this point is a
        // cheap validation with no side effect to unwind if it fails. A
        // retried/duplicated request carrying the SAME key hits the UNIQUE
        // index and gets the first attempt's own outcome back instead of
        // creating a second Meta campaign — unlike the old "no row in the
        // last 2 minutes" heuristic this replaces, which two near-
        // simultaneous requests could both pass, since neither had written
        // a row yet at the moment it checked.
        const campaignRowId = crypto.randomUUID();
        try {
          await db()
            .prepare(
              `INSERT INTO ad_campaigns
                 (id, request_id, user_id, meta_campaign_id, objective,
                  daily_budget_cents, duration_days, status, idempotency_key)
               VALUES (?1, ?2, ?3, '', ?4, ?5, ?6, 'creating', ?7)`,
            )
            .bind(
              campaignRowId,
              reqRow.id,
              user.id,
              parsed.data.objective,
              Math.round(parsed.data.dailyBudgetMxn * 100),
              parsed.data.durationDays,
              parsed.data.idempotencyKey,
            )
            .run();
        } catch {
          // UNIQUE(idempotency_key) violation — this exact submission was
          // already attempted. Replay its outcome instead of creating
          // anything new in Meta.
          const existing = await db()
            .prepare(
              `SELECT id, status, error_message FROM ad_campaigns
               WHERE idempotency_key = ?1 AND user_id = ?2`,
            )
            .bind(parsed.data.idempotencyKey, user.id)
            .first<{ id: string; status: string; error_message: string | null }>();
          if (!existing) return json({ ok: false, error: "campana_duplicada" }, { status: 409 });
          if (existing.status === "creating") {
            return json({ ok: false, error: "campana_en_proceso" }, { status: 409 });
          }
          if (existing.status === "creation_failed") {
            return json(
              { ok: false, error: existing.error_message ?? "meta_error" },
              { status: 502 },
            );
          }
          return json({
            ok: true,
            id: existing.id,
            warning: existing.error_message ?? null,
            complete: existing.status === "paused",
          });
        }

        const result = await createPausedCampaignForRequest({
          adAccountId,
          accessToken: oauthAccessToken,
          requestTitle: reqRow.title,
          objective: parsed.data.objective,
          dailyBudgetCents: Math.round(parsed.data.dailyBudgetMxn * 100),
          durationDays: parsed.data.durationDays,
          media,
          adMessages: parsed.data.adMessages,
          ageMin: parsed.data.ageMin,
          ageMax: parsed.data.ageMax,
          locationKey: parsed.data.locationKey ?? null,
          customLocation:
            parsed.data.customLat != null && parsed.data.customLon != null
              ? { lat: parsed.data.customLat, lon: parsed.data.customLon }
              : null,
          radiusKm: parsed.data.radiusKm ?? null,
          interestIds: parsed.data.interestIds,
          pageId,
          trafficDestination: parsed.data.trafficDestination ?? null,
          messagingChannels: parsed.data.messagingChannels,
          whatsappNumber: parsed.data.whatsappNumber ?? null,
          websiteUrl: parsed.data.websiteUrl ?? null,
        });

        if (!result.ok) {
          // Nothing was created in Meta at all (the Campaign call itself
          // failed) — record that plainly against the reserved row rather
          // than leaving it stuck at 'creating' forever, and never hide
          // the real Meta error from the client.
          await db()
            .prepare(
              "UPDATE ad_campaigns SET status = 'creation_failed', error_message = ?2, updated_at = datetime('now') WHERE id = ?1",
            )
            .bind(campaignRowId, result.error)
            .run();
          return json({ ok: false, error: result.error }, { status: 502 });
        }

        // Complete when the ad set AND at least one ad actually exist —
        // anything less (Meta created the Campaign/AdSet but the Ad
        // failed, etc.) is recorded as a partial creation, never silently
        // upgraded to "paused" as if it were fully usable. The Meta
        // objects that DID get created are never deleted here (see
        // meta-ads-create.server.ts) — they're real, paused, and visible
        // in Ads Manager either way; this just tracks the true state.
        const complete = Boolean(result.adsetId) && result.adIds.length > 0;
        await db()
          .prepare(
            `UPDATE ad_campaigns
             SET meta_campaign_id = ?2, meta_adset_id = ?3, meta_ad_id = ?4,
                 status = ?5, error_message = ?6, updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(
            campaignRowId,
            result.campaignId,
            result.adsetId,
            // Several ads (one per copy variant) now, so this holds a JSON
            // array instead of a single id — nothing reads it back yet,
            // it's kept for bookkeeping/support lookups in Ads Manager.
            JSON.stringify(result.adIds),
            complete ? "paused" : "partial_creation",
            result.warning ?? null,
          )
          .run();

        return json({
          ok: true,
          id: campaignRowId,
          warning: result.warning ?? null,
          // A warning doesn't always mean something's missing — e.g. an
          // invalid interest id gets dropped and retried rather than
          // failing the ad set, so campaign+ad set+ad all exist. The
          // client uses this to tell "fully created, minor caveat" apart
          // from "genuinely incomplete, go check Ads Manager."
          complete,
        });
      },
    },
  },
});
