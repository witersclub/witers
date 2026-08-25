import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../lib/brand-profile.server";
import { createCarouselRequest } from "./carousel-requests";
import { createImageRequest } from "./requests";
import { createVideoRequest } from "./video-requests";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

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
const schema = z.object({ entryId: z.string().uuid() });

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

        const brand = await getBrandProfile(user.id);
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        let result: { ok: true; id: string } | { ok: false; error: string; status: number };
        if (entry.format === "imagen") {
          result = await createImageRequest(user.id, user.name, {
            title: entry.title,
            companyName: brand.company_name,
            pieceBrief: entry.brief,
            aspectRatio: "1:1",
            lang: "es",
            brandColors: brand.brand_colors,
            businessType: brand.business_type,
            logoKey: brand.logo_key,
            noLogo: !brand.logo_key,
          });
        } else if (entry.format === "carrusel") {
          const slides = entry.slides_json ? parseSlides(entry.slides_json) : null;
          if (!slides || slides.length !== 4) {
            return json({ ok: false, error: "faltan_laminas" }, { status: 409 });
          }
          result = await createCarouselRequest(user.id, user.name, {
            title: entry.title,
            aspectRatio: "1:1",
            slides,
          });
        } else {
          // El cliente no tiene metraje propio al planear el mes — el guion
          // completo que Wit ya redactó se manda como aiScenesNote, sin
          // archivos, para que el equipo lo resuelva con stock/IA. Sigue
          // siendo un solo clic, sin subir nada.
          result = await createVideoRequest(user.id, user.name, {
            title: entry.title,
            purpose: entry.brief,
            platform: "instagram",
            aspectRatio: "9:16",
            wantsAiScenes: true,
            aiScenesNote: entry.brief,
            rawFileKeys: [],
          });
        }
        if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });

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
