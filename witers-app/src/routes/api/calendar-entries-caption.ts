import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandMemory } from "../../lib/brand-memory.server";
import { getBrandProfile } from "../../lib/brand-profile.server";
import { generateCalendarCaption } from "../../lib/calendar-caption.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type CalendarFormat = "imagen" | "video" | "carrusel";
type EntryRow = {
  id: string;
  format: CalendarFormat;
  title: string;
  brief: string;
  slides_json: string | null;
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

// Generates (or regenerates, same call) the suggested social copy for a
// planned entry, from whatever brief/guion/slides Wit already wrote for
// it — works regardless of status, since that content exists from the
// moment the piece is planned, not only once delivered. Cached on the row
// so opening the same piece again doesn't call OpenAI a second time; the
// client's "Regenerar" button just calls this same endpoint again.
const schema = z.object({ entryId: z.string().uuid() });
const editSchema = z.object({
  entryId: z.string().uuid(),
  caption: z.string().min(1).max(5000),
});

export const Route = createFileRoute("/api/calendar-entries-caption")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const entry = await db()
          .prepare(
            "SELECT id, format, title, brief, slides_json FROM calendar_entries WHERE id = ?1 AND user_id = ?2",
          )
          .bind(parsed.data.entryId, user.id)
          .first<EntryRow>();
        if (!entry) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        const brand = await getBrandProfile(user.id);
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const result = await generateCalendarCaption({
          companyName: brand.company_name,
          businessType: brand.business_type,
          brandMemory: await getBrandMemory(user.id),
          format: entry.format,
          title: entry.title,
          brief: entry.brief,
          slides: entry.slides_json ? parseSlides(entry.slides_json) : null,
        });
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });

        await db()
          .prepare("UPDATE calendar_entries SET caption = ?2 WHERE id = ?1")
          .bind(entry.id, result.caption)
          .run();

        return json({ ok: true, caption: result.caption });
      },
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = editSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const result = await db()
          .prepare(
            `UPDATE calendar_entries SET caption = ?3
             WHERE id = ?1 AND user_id = ?2`,
          )
          .bind(parsed.data.entryId, user.id, parsed.data.caption.trim())
          .run();
        return result.meta.changes
          ? json({ ok: true, caption: parsed.data.caption.trim() })
          : json({ ok: false, error: "no_encontrada" }, { status: 404 });
      },
    },
  },
});
