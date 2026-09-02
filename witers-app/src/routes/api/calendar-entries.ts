import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { isProductionReadyCalendarEntry } from "../../lib/wit-chat.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";
import { getPlan } from "../../lib/membership-plans";

type CalendarFormat = "imagen" | "video" | "carrusel";
type EntryRow = {
  id: string;
  scheduled_date: string;
  slot_index: number;
  format: CalendarFormat;
  title: string;
  brief: string;
  slides_json: string | null;
  request_id: string | null;
  caption: string | null;
  publication_status: string | null;
  scheduled_for_utc: string | null;
  publication_timezone: string | null;
  publication_platforms: string | null;
  production_ready_at: string | null;
};

type SlideDraft = { title?: string; brief: string };

function parseSlides(json: string): SlideDraft[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as SlideDraft[]) : null;
  } catch {
    return null;
  }
}

const REQUEST_TABLE: Record<CalendarFormat, string> = {
  imagen: "design_requests",
  video: "video_requests",
  carrusel: "carousel_requests",
};

// completada/cerrada = delivered; anything else (nueva, en_proceso,
// cambio_solicitado) is still in the design pipeline — same three-state
// vocabulary the "Planificación" mockup settled on (por_planear / en_diseno
// / lista), confirmed against panel.tsx's own status groupings and the
// admin/deliver*.ts handlers that set 'completada'/'cerrada'.
function statusBucket(requestStatus: string): "en_diseno" | "lista" {
  return requestStatus === "completada" || requestStatus === "cerrada" ? "lista" : "en_diseno";
}

const slideSchema = z.object({
  title: z.string().max(120).optional(),
  brief: z.string().min(5).max(2000),
});
const createEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: z.number().int().min(1).max(2).default(1),
    format: z.enum(["imagen", "video", "carrusel"]),
    title: z.string().min(1).max(120),
    brief: z.string().min(1).max(2000),
    slides: z.array(slideSchema).length(4).optional(),
  })
  .refine((d) => d.format !== "carrusel" || d.slides?.length === 4, {
    message: "carrusel_requiere_4_laminas",
    path: ["slides"],
  });
const bulkCreateSchema = z.object({
  entries: z.array(createEntrySchema).min(1).max(62),
});

// Solo título/brief/slides son editables directo — nunca fecha ni formato
// (eso implicaría re-planear, ya cubierto por "Replanear mes"). slides es
// opcional en el schema porque solo aplica a carrusel; se exige más abajo
// en el handler según el formato real de la fila.
const editEntrySchema = z.object({
  entryId: z.string().uuid(),
  title: z.string().min(1).max(120),
  brief: z.string().min(1).max(2000),
  slides: z.array(slideSchema).length(4).optional(),
});

function monthRange(url: URL): { monthStart: string; monthEnd: string } {
  const now = new Date();
  const year = Number(url.searchParams.get("year")) || now.getUTCFullYear();
  const month = Number(url.searchParams.get("month")) || now.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { monthStart, monthEnd };
}

export const Route = createFileRoute("/api/calendar-entries")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const { monthStart, monthEnd } = monthRange(new URL(request.url));

        const rows = await db()
          .prepare(
            `SELECT e.id, e.scheduled_date, e.slot_index, e.format, e.title, e.brief, e.slides_json, e.production_ready_at,
                    e.request_id, e.caption, s.status AS publication_status,
                    s.scheduled_for_utc, s.timezone AS publication_timezone,
                    s.platforms_json AS publication_platforms
             FROM calendar_entries e
             LEFT JOIN calendar_entry_schedules s ON s.entry_id = e.id
             WHERE e.user_id = ?1 AND e.scheduled_date BETWEEN ?2 AND ?3
             ORDER BY e.scheduled_date ASC, e.slot_index ASC`,
          )
          .bind(user.id, monthStart, monthEnd)
          .all<EntryRow>();
        const entries = rows.results ?? [];

        // Resolve status for linked entries with one query per format
        // (never a polymorphic JOIN across three differently-shaped tables).
        // Once a format's IDs resolve to "lista", one more query per format
        // fetches the actual delivered content for just that subset — so a
        // month still "en_diseno" never pays for a lookup that would come
        // back empty anyway.
        const statusById = new Map<string, string>();
        const thumbById = new Map<string, string>(); // requestId -> grid-cell thumbnail
        const galleryById = new Map<string, string[]>(); // requestId -> full delivered gallery
        const videoHrefById = new Map<string, string>(); // requestId -> delivered video src

        for (const format of Object.keys(REQUEST_TABLE) as CalendarFormat[]) {
          const ids = entries
            .filter((e) => e.format === format && e.request_id)
            .map((e) => e.request_id as string);
          if (ids.length === 0) continue;
          const placeholders = ids.map((_, i) => `?${i + 1}`).join(", ");
          const statusRows = await db()
            .prepare(
              `SELECT id, status FROM ${REQUEST_TABLE[format]} WHERE id IN (${placeholders})`,
            )
            .bind(...ids)
            .all<{ id: string; status: string }>();
          for (const row of statusRows.results ?? []) statusById.set(row.id, row.status);

          const listaIds = ids.filter(
            (id) => statusBucket(statusById.get(id) ?? "en_proceso") === "lista",
          );
          if (listaIds.length === 0) continue;
          const listaPlaceholders = listaIds.map((_, i) => `?${i + 1}`).join(", ");

          if (format === "imagen") {
            // Same "latest non-draft result" correlated-subquery shape as
            // requests.ts's own GET, scoped to just the delivered IDs.
            const imgRows = await db()
              .prepare(
                `SELECT dr.id AS request_id,
                   (SELECT rr.image_url FROM request_results rr
                    WHERE rr.request_id = dr.id AND rr.kind != 'draft'
                    ORDER BY rr.created_at DESC LIMIT 1) AS image_url,
                   (SELECT rr.r2_key FROM request_results rr
                    WHERE rr.request_id = dr.id AND rr.kind != 'draft'
                    ORDER BY rr.created_at DESC LIMIT 1) AS r2_key
                 FROM design_requests dr WHERE dr.id IN (${listaPlaceholders})`,
              )
              .bind(...listaIds)
              .all<{ request_id: string; image_url: string | null; r2_key: string | null }>();
            for (const row of imgRows.results ?? []) {
              const href =
                row.image_url ??
                (row.r2_key ? `/api/file?key=${encodeURIComponent(row.r2_key)}` : null);
              if (href) {
                thumbById.set(row.request_id, href);
                galleryById.set(row.request_id, [href]);
              }
            }
          } else if (format === "carrusel") {
            const slideRows = await db()
              .prepare(
                `SELECT carousel_request_id, delivered_key FROM carousel_slides
                 WHERE carousel_request_id IN (${listaPlaceholders}) AND delivered_key IS NOT NULL
                 ORDER BY slide_index ASC`,
              )
              .bind(...listaIds)
              .all<{ carousel_request_id: string; delivered_key: string }>();
            for (const row of slideRows.results ?? []) {
              const href = `/api/file?key=${encodeURIComponent(row.delivered_key)}`;
              const gallery = galleryById.get(row.carousel_request_id) ?? [];
              gallery.push(href);
              galleryById.set(row.carousel_request_id, gallery);
              if (!thumbById.has(row.carousel_request_id)) {
                thumbById.set(row.carousel_request_id, href);
              }
            }
          } else {
            // video: no stored still frame to use as a grid-cell thumbnail
            // (same limitation as panel.tsx's "Mis solicitudes" strip) —
            // only the full delivered file, for the detail panel's player.
            const videoRows = await db()
              .prepare(
                `SELECT id, delivered_key FROM video_requests
                 WHERE id IN (${listaPlaceholders}) AND delivered_key IS NOT NULL`,
              )
              .bind(...listaIds)
              .all<{ id: string; delivered_key: string }>();
            for (const row of videoRows.results ?? []) {
              videoHrefById.set(row.id, `/api/file?key=${encodeURIComponent(row.delivered_key)}`);
            }
          }
        }

        const withStatus = entries.map((e) => ({
          id: e.id,
          date: e.scheduled_date,
          slot: e.slot_index,
          format: e.format,
          title: e.title,
          brief: e.brief,
          slides: e.slides_json ? parseSlides(e.slides_json) : null,
          requestId: e.request_id,
          status: e.request_id
            ? statusBucket(statusById.get(e.request_id) ?? "en_proceso")
            : ("por_planear" as const),
          thumbHref: e.request_id ? (thumbById.get(e.request_id) ?? null) : null,
          deliveredImages: e.request_id ? (galleryById.get(e.request_id) ?? null) : null,
          deliveredVideoHref: e.request_id ? (videoHrefById.get(e.request_id) ?? null) : null,
          caption: e.caption,
          publicationStatus: e.publication_status,
          scheduledForUtc: e.scheduled_for_utc,
          publicationTimezone: e.publication_timezone,
          publicationPlatforms: e.publication_platforms
            ? (JSON.parse(e.publication_platforms) as ("facebook" | "instagram")[])
            : null,
          productionReady: Boolean(e.production_ready_at),
        }));

        return json({ ok: true, entries: withStatus });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = bulkCreateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        if (
          !parsed.data.entries.every((entry) =>
            isProductionReadyCalendarEntry({
              ...entry,
              ...(entry.slides
                ? {
                    slides: entry.slides.map((slide) => ({
                      title: slide.title?.trim() || "",
                      brief: slide.brief,
                    })),
                  }
                : {}),
            }),
          )
        )
          return json({ ok: false, error: "brief_produccion_incompleto" }, { status: 422 });

        // Planning is free — no production quota check here. The active plan
        // does define how many pieces Wit may place on the same date.
        const membership = await db()
          .prepare("SELECT plan FROM memberships WHERE user_id = ?1")
          .bind(user.id)
          .first<{ plan: string }>();
        const maxSlots = getPlan(membership?.plan).planningSlotsPerDay;
        const seenSlots = new Set<string>();
        for (const entry of parsed.data.entries) {
          const key = `${entry.date}:${entry.slot}`;
          if (entry.slot > maxSlots || seenSlots.has(key)) {
            return json({ ok: false, error: "slot_no_disponible" }, { status: 409 });
          }
          seenSlots.add(key);
        }
        const plannedDates = [...new Set(parsed.data.entries.map((entry) => entry.date))];
        const placeholders = plannedDates.map((_, i) => `?${i + 2}`).join(", ");
        const existing = await db()
          .prepare(
            `SELECT scheduled_date, slot_index FROM calendar_entries
             WHERE user_id = ?1 AND scheduled_date IN (${placeholders})`,
          )
          .bind(user.id, ...plannedDates)
          .all<{ scheduled_date: string; slot_index: number }>();
        const existingSlots = new Set(
          (existing.results ?? []).map((row) => `${row.scheduled_date}:${row.slot_index}`),
        );
        if (parsed.data.entries.some((entry) => existingSlots.has(`${entry.date}:${entry.slot}`))) {
          return json({ ok: false, error: "fecha_ya_planeada" }, { status: 409 });
        }

        // Only actually
        // requesting a planned piece (/api/calendar-entries-request) spends
        // cupo, same as every other request-creation path in this app.
        for (const entry of parsed.data.entries) {
          await db()
            .prepare(
              `INSERT INTO calendar_entries (id, user_id, scheduled_date, slot_index, format, title, brief, slides_json, production_ready_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))`,
            )
            .bind(
              crypto.randomUUID(),
              user.id,
              entry.date,
              entry.slot,
              entry.format,
              entry.title.trim(),
              entry.brief.trim(),
              entry.format === "carrusel" ? JSON.stringify(entry.slides) : null,
            )
            .run();
        }

        return json({ ok: true, count: parsed.data.entries.length });
      },

      // Edición directa de una pieza — mientras siga "por planear" (sin
      // request_id), el cliente puede corregir el título/brief (o las 4
      // láminas si es carrusel) sin pasar por otra conversación con Wit ni
      // por "Replanear mes". Una vez pedida, la pieza ya vive en el
      // pipeline real de diseño y esto deja de aplicar — para eso están los
      // flujos de "solicitar cambio" existentes en cada formato.
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = editEntrySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const entry = await db()
          .prepare("SELECT format, request_id FROM calendar_entries WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.entryId, user.id)
          .first<{ format: CalendarFormat; request_id: string | null }>();
        if (!entry) return json({ ok: false, error: "no_encontrada" }, { status: 404 });
        if (entry.request_id) return json({ ok: false, error: "ya_pedida" }, { status: 409 });
        if (entry.format === "carrusel" && parsed.data.slides?.length !== 4) {
          return json({ ok: false, error: "faltan_laminas" }, { status: 400 });
        }

        await db()
          .prepare(
            `UPDATE calendar_entries SET title = ?2, brief = ?3, slides_json = ?4
             WHERE id = ?1 AND request_id IS NULL`,
          )
          .bind(
            parsed.data.entryId,
            parsed.data.title.trim(),
            parsed.data.brief.trim(),
            entry.format === "carrusel" ? JSON.stringify(parsed.data.slides) : null,
          )
          .run();

        return json({ ok: true });
      },

      // "Replanear mes" — clears only the entries the client never acted on
      // (request_id IS NULL) for the given month, so a fresh Wit
      // conversation can re-propose them. Entries already turned into a
      // real request are never touched here: a designer may already be
      // working on that piece, so silently dropping it from the calendar
      // would orphan it from the client's view without actually undoing
      // any real work.
      DELETE: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const { monthStart, monthEnd } = monthRange(new URL(request.url));

        const result = await db()
          .prepare(
            `DELETE FROM calendar_entries
             WHERE user_id = ?1 AND scheduled_date BETWEEN ?2 AND ?3 AND request_id IS NULL`,
          )
          .bind(user.id, monthStart, monthEnd)
          .run();

        return json({ ok: true, deleted: result.meta.changes ?? 0 });
      },
    },
  },
});
