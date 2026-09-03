import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildBrandContext } from "../../lib/brand-context.server";
import {
  isProductionReadyCalendarEntry,
  runWitCalendarEntryExpansion,
} from "../../lib/wit-chat.server";
import { createCarouselRequest } from "./carousel-requests";
import { createImageRequest } from "./requests";
import { createVideoRequest } from "./video-requests";
import { db, getMembership, getSessionUser, json } from "../../lib/witers-auth.server";

type EntryRow = {
  id: string;
  format: "imagen" | "video" | "carrusel";
  title: string;
  brief: string;
  slides_json: string | null;
  request_id: string | null;
};

type SlideDraft = { title?: string | null; brief: string };

function parseSlides(json: string): SlideDraft[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as SlideDraft[]) : null;
  } catch {
    return null;
  }
}

// Un clic, los tres formatos: la pieza ya viene profesional y completa
// desde la planeación (ver runWitCalendarChat/buildCalendarSystemPrompt en
// wit-chat.server.ts), así que aquí solo se convierte en la solicitud real
// reutilizando exactamente la misma lógica que cada flujo manual —
// imagen/carrusel/video — nunca una copia aparte que pueda desalinearse en
// cupo o columnas. Video no requiere metraje propio: el guion que Wit ya
// escribió se manda como aiScenesNote para que el equipo resuelva con
// stock/IA.
//
// El formato lo elige el cliente en el selector visual justo antes de
// pedir la pieza (mismo AspectRatioPicker que ya usa el chat normal de
// Wit) — aspectRatio llega opcional y se valida contra el enum real de
// cada formato en el servidor, nunca se confía ciegamente en lo que mande
// el cliente. Sin elección, cae al default de cada formato: 3:4 para
// imagen/carrusel (feed vertical), 9:16 para video (reel/historia).
const IMAGE_CAROUSEL_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;
const VIDEO_RATIOS = ["9:16", "1:1", "16:9"] as const;
const schema = z.object({
  entryId: z.string().uuid(),
  aspectRatio: z.string().optional(),
});

export const Route = createFileRoute("/api/calendar-entries-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const entry = await db()
          .prepare(
            "SELECT id, format, title, brief, slides_json, request_id FROM calendar_entries WHERE id = ?1 AND user_id = ?2",
          )
          .bind(parsed.data.entryId, user.id)
          .first<EntryRow>();
        if (!entry) return json({ ok: false, error: "no_encontrada" }, { status: 404 });
        if (entry.request_id) return json({ ok: false, error: "ya_pedida" }, { status: 409 });

        const brandContext = await buildBrandContext(user.id);
        if (!brandContext) return json({ ok: false, error: "falta_marca" }, { status: 409 });
        const brand = brandContext.profile;

        let productionEntry: {
          format: "imagen" | "video" | "carrusel";
          title: string;
          brief: string;
          slides?: { title: string; brief: string }[];
        } = {
          format: entry.format,
          title: entry.title,
          brief: entry.brief,
          ...(entry.slides_json
            ? {
                slides: (parseSlides(entry.slides_json) ?? []).map((slide) => ({
                  title: slide.title?.trim() || "",
                  brief: slide.brief.trim(),
                })),
              }
            : {}),
        };
        // Legacy plans can contain a topic-level outline. Complete that
        // record before any format reaches production; this is a safety net
        // for old data, not a second client-facing planning step.
        if (!isProductionReadyCalendarEntry(productionEntry)) {
          const expanded = await runWitCalendarEntryExpansion(
            productionEntry,
            brandContext.context,
          );
          if (!expanded.ok)
            return json({ ok: false, error: "brief_produccion_incompleto" }, { status: 422 });
          productionEntry = {
            format: entry.format,
            title: expanded.title,
            brief: expanded.brief,
            ...(entry.format === "carrusel" ? { slides: expanded.slides } : {}),
          };
          if (!isProductionReadyCalendarEntry(productionEntry))
            return json({ ok: false, error: "brief_produccion_incompleto" }, { status: 422 });
          await db()
            .prepare(
              "UPDATE calendar_entries SET title = ?2, brief = ?3, slides_json = ?4, production_ready_at = datetime('now') WHERE id = ?1 AND user_id = ?5 AND request_id IS NULL",
            )
            .bind(
              entry.id,
              productionEntry.title,
              productionEntry.brief,
              entry.format === "carrusel" ? JSON.stringify(productionEntry.slides) : null,
              user.id,
            )
            .run();
        }

        let result: { ok: true; id: string } | { ok: false; error: string; status: number };
        if (entry.format === "imagen") {
          const aspectRatio = IMAGE_CAROUSEL_RATIOS.includes(
            parsed.data.aspectRatio as (typeof IMAGE_CAROUSEL_RATIOS)[number],
          )
            ? (parsed.data.aspectRatio as (typeof IMAGE_CAROUSEL_RATIOS)[number])
            : "3:4";
          result = await createImageRequest(user.id, user.name, {
            title: productionEntry.title,
            companyName: brand.company_name,
            pieceBrief: productionEntry.brief,
            aspectRatio,
            lang: "es",
            brandColors: brand.brand_colors,
            businessType: brand.business_type,
            logoKey: brand.logo_key,
            noLogo: !brand.logo_key,
          });
        } else if (entry.format === "carrusel") {
          const slides = productionEntry.slides;
          if (!slides || slides.length !== 4) {
            return json({ ok: false, error: "faltan_laminas" }, { status: 409 });
          }
          const aspectRatio = IMAGE_CAROUSEL_RATIOS.includes(
            parsed.data.aspectRatio as (typeof IMAGE_CAROUSEL_RATIOS)[number],
          )
            ? (parsed.data.aspectRatio as (typeof IMAGE_CAROUSEL_RATIOS)[number])
            : "3:4";
          result = await createCarouselRequest(user.id, user.name, {
            title: productionEntry.title,
            aspectRatio,
            slides,
          });
        } else {
          const aspectRatio = VIDEO_RATIOS.includes(
            parsed.data.aspectRatio as (typeof VIDEO_RATIOS)[number],
          )
            ? (parsed.data.aspectRatio as (typeof VIDEO_RATIOS)[number])
            : "9:16";
          // El cliente no tiene metraje propio al planear el mes — el guion
          // completo que Wit ya redactó se manda como aiScenesNote, sin
          // archivos, para que el equipo lo resuelva con stock/IA. Sigue
          // siendo un solo clic, sin subir nada.
          result = await createVideoRequest(user.id, user.name, {
            title: productionEntry.title,
            purpose: productionEntry.brief,
            platform: "instagram",
            aspectRatio,
            wantsAiScenes: true,
            aiScenesNote: productionEntry.brief,
            rawFileKeys: [],
          });
        }
        if (!result.ok) {
          // imagen/video/carrusel all spend from the same shared monthly
          // pool (see createImageRequest in requests.ts) — send the actual
          // used/quota numbers so the UI can say precisely how full that
          // pool is instead of a bare "ya no te queda nada".
          if (result.error === "sin_saldo") {
            const membership = await getMembership(user.id);
            return json(
              {
                ok: false,
                error: result.error,
                ...(membership
                  ? {
                      used: membership.requests_used,
                      quota: membership.requests_quota + membership.bonus_requests_quota,
                    }
                  : {}),
              },
              { status: result.status },
            );
          }
          return json({ ok: false, error: result.error }, { status: result.status });
        }

        await db()
          .prepare(
            "UPDATE calendar_entries SET request_id = ?2 WHERE id = ?1 AND request_id IS NULL",
          )
          .bind(entry.id, result.id)
          .run();

        return json({ ok: true, requestId: result.id });
      },
    },
  },
});
