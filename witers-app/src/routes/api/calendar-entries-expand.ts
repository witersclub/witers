import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildBrandContext } from "../../lib/brand-context.server";
import { runWitCalendarEntryExpansion } from "../../lib/wit-chat.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ entryId: z.string().uuid() });
type Entry = {
  id: string;
  format: "imagen" | "video" | "carrusel";
  title: string;
  brief: string;
  slides_json: string | null;
  request_id: string | null;
  production_ready_at: string | null;
};

function parseSlides(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// Expands only the piece the client is viewing. Monthly planning remains a
// small, dependable operation; this endpoint owns the richer creative work.
export const Route = createFileRoute("/api/calendar-entries-expand")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const entry = await db()
          .prepare(
            "SELECT id, format, title, brief, slides_json, request_id, production_ready_at FROM calendar_entries WHERE id = ?1 AND user_id = ?2",
          )
          .bind(parsed.data.entryId, user.id)
          .first<Entry>();
        if (!entry) return json({ ok: false, error: "no_encontrada" }, { status: 404 });
        if (entry.request_id || entry.production_ready_at) return json({ ok: true, cached: true });
        const brand = await buildBrandContext(user.id);
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });
        const result = await runWitCalendarEntryExpansion(
          {
            format: entry.format,
            title: entry.title,
            brief: entry.brief,
            slides: parseSlides(entry.slides_json),
          },
          brand.context,
        );
        if (!result.ok)
          return json(result, { status: result.error === "tiempo_agotado" ? 504 : 502 });
        await db()
          .prepare(
            "UPDATE calendar_entries SET title = ?2, brief = ?3, slides_json = ?4, production_ready_at = datetime('now') WHERE id = ?1 AND user_id = ?5 AND request_id IS NULL",
          )
          .bind(
            entry.id,
            result.title,
            result.brief,
            entry.format === "carrusel" ? JSON.stringify(result.slides) : null,
            user.id,
          )
          .run();
        return json({ ok: true, cached: false });
      },
    },
  },
});
