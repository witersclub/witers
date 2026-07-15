import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Buffer } from "node:buffer";

import { bindings } from "../../lib/bindings.server";
import { getBrandProfile } from "../../lib/brand-profile.server";
import { createPausedCampaignForRequest } from "../../lib/meta-ads.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z
  .object({
    requestId: z.string().min(1),
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
    radiusKm: z.number().min(5).max(50).optional(),
    interestIds: z.array(z.string().min(1)).max(10).default([]),
    adMessages: z.array(z.string().min(1).max(500)).min(1).max(3),
    // Required only for "ventas" (drives the wa.me link) — the client
    // types it themselves each time, it's not stored on their profile.
    whatsappNumber: z.string().min(6).max(20).optional(),
  })
  .refine((v) => v.ageMin <= v.ageMax, { message: "rango_edad_invalido" })
  .refine((v) => v.objective !== "ventas" || Boolean(v.whatsappNumber), {
    message: "falta_whatsapp",
  });

type RequestRow = { id: string; user_id: string; title: string; status: string };
type ResultRow = { r2_key: string | null; image_url: string | null };

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
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const reqRow = await db()
          .prepare("SELECT id, user_id, title, status FROM design_requests WHERE id = ?1")
          .bind(parsed.data.requestId)
          .first<RequestRow>();
        if (!reqRow || reqRow.user_id !== user.id) {
          return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        }
        if (reqRow.status !== "completada" && reqRow.status !== "cerrada") {
          return json({ ok: false, error: "solicitud_no_terminada" }, { status: 409 });
        }

        // No shared/default Page: each client pautas from their own,
        // set only by an admin once it's connected to WITERS's Business
        // Manager (see /api/admin/update-brand-profile).
        const brandProfile = await getBrandProfile(user.id);
        if (!brandProfile?.meta_page_id) {
          return json({ ok: false, error: "pagina_no_conectada" }, { status: 409 });
        }

        const resultRow = await db()
          .prepare(
            `SELECT r2_key, image_url FROM request_results
             WHERE request_id = ?1 AND kind != 'draft'
             ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(reqRow.id)
          .first<ResultRow>();
        if (!resultRow?.r2_key) {
          return json({ ok: false, error: "sin_pieza_final" }, { status: 409 });
        }

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });
        const obj = await STORAGE.get(resultRow.r2_key);
        if (!obj) return json({ ok: false, error: "archivo_no_encontrado" }, { status: 404 });
        const bytes = await obj.arrayBuffer();
        // Spreading a large Uint8Array into String.fromCharCode(...) blows
        // the call stack for real design files (a few hundred KB+) — this
        // is what "RangeError: Maximum call stack size exceeded" was.
        const imageBytesBase64 = Buffer.from(bytes).toString("base64");
        const imageContentType = obj.httpMetadata?.contentType ?? "image/png";

        const result = await createPausedCampaignForRequest({
          requestTitle: reqRow.title,
          objective: parsed.data.objective,
          dailyBudgetCents: Math.round(parsed.data.dailyBudgetMxn * 100),
          durationDays: parsed.data.durationDays,
          imageBytesBase64,
          imageContentType,
          adMessages: parsed.data.adMessages,
          ageMin: parsed.data.ageMin,
          ageMax: parsed.data.ageMax,
          locationKey: parsed.data.locationKey ?? null,
          radiusKm: parsed.data.radiusKm ?? null,
          interestIds: parsed.data.interestIds,
          pageId: brandProfile.meta_page_id,
          whatsappNumber: parsed.data.whatsappNumber ?? null,
        });

        if (!result.ok) {
          return json({ ok: false, error: result.error }, { status: 502 });
        }

        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO ad_campaigns
               (id, request_id, user_id, meta_campaign_id, meta_adset_id, meta_ad_id, objective, daily_budget_cents, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'paused')`,
          )
          .bind(
            id,
            reqRow.id,
            user.id,
            result.campaignId,
            result.adsetId,
            // Several ads (one per copy variant) now, so this holds a JSON
            // array instead of a single id — nothing reads it back yet,
            // it's kept for bookkeeping/support lookups in Ads Manager.
            JSON.stringify(result.adIds),
            parsed.data.objective,
            Math.round(parsed.data.dailyBudgetMxn * 100),
          )
          .run();

        return json({ ok: true, id, warning: result.warning ?? null });
      },
    },
  },
});
