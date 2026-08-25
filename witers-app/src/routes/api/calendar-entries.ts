import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type CalendarFormat = "imagen" | "video" | "carrusel";
type EntryRow = {
  id: string;
  scheduled_date: string;
  format: CalendarFormat;
  title: string;
  brief: string;
  request_id: string | null;
};

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

const createEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(["imagen", "video", "carrusel"]),
  title: z.string().min(1).max(120),
  brief: z.string().min(1).max(2000),
});
const bulkCreateSchema = z.object({
  entries: z.array(createEntrySchema).min(1).max(60),
});

export const Route = createFileRoute("/api/calendar-entries")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const url = new URL(request.url);
        const now = new Date();
        const year = Number(url.searchParams.get("year")) || now.getUTCFullYear();
        const month = Number(url.searchParams.get("month")) || now.getUTCMonth() + 1;
        const pad = (n: number) => String(n).padStart(2, "0");
        const monthStart = `${year}-${pad(month)}-01`;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

        const rows = await db()
          .prepare(
            `SELECT id, scheduled_date, format, title, brief, request_id
             FROM calendar_entries
             WHERE user_id = ?1 AND scheduled_date BETWEEN ?2 AND ?3
             ORDER BY scheduled_date ASC`,
          )
          .bind(user.id, monthStart, monthEnd)
          .all<EntryRow>();
        const entries = rows.results ?? [];

        // Resolve status for linked entries with one query per format
        // (never a polymorphic JOIN across three differently-shaped tables).
        const statusById = new Map<string, string>();
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
        }

        const withStatus = entries.map((e) => ({
          id: e.id,
          date: e.scheduled_date,
          format: e.format,
          title: e.title,
          brief: e.brief,
          requestId: e.request_id,
          status: e.request_id
            ? statusBucket(statusById.get(e.request_id) ?? "en_proceso")
            : ("por_planear" as const),
        }));

        return json({ ok: true, entries: withStatus });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = bulkCreateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        // Planning is free — no membership/quota check here. Only actually
        // requesting a planned piece (/api/calendar-entries-request) spends
        // cupo, same as every other request-creation path in this app.
        for (const entry of parsed.data.entries) {
          await db()
            .prepare(
              `INSERT INTO calendar_entries (id, user_id, scheduled_date, format, title, brief)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
            )
            .bind(
              crypto.randomUUID(),
              user.id,
              entry.date,
              entry.format,
              entry.title.trim(),
              entry.brief.trim(),
            )
            .run();
        }

        return json({ ok: true, count: parsed.data.entries.length });
      },
    },
  },
});
