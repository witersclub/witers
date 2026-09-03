import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildMonthDates, computeReorderShift } from "../../lib/calendar-reorder";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  entryId: z.string().uuid(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// CAMBIO 03 — Instagram-style "reorder grid" drag on the planning
// calendar, not a plain two-cell swap: dropping the piece from the 8th
// onto the 3rd shifts everything from the 3rd through the 7th one day
// later, closing the gap the dragged piece left at the 8th — see
// calendar-reorder.ts, shared with calendar-planning.tsx's live preview
// while dragging so what you see mid-drag is exactly what gets saved.
//
// Deliberately separate from the PATCH on /api/calendar-entries: that one
// edits a piece's own content and refuses once request_id is set — the
// guard that should NOT apply here. Moving a piece already in production
// (en_diseno/lista) is allowed; its status travels with it since status
// lives on the entry row, never on the date.
export const Route = createFileRoute("/api/calendar-entries-move")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const { entryId, targetDate } = parsed.data;

        if (targetDate < todayIso()) {
          return json({ ok: false, error: "fecha_pasada" }, { status: 409 });
        }

        const dragged = await db()
          .prepare(
            "SELECT id, scheduled_date FROM calendar_entries WHERE id = ?1 AND user_id = ?2 AND slot_index = 1",
          )
          .bind(entryId, user.id)
          .first<{ id: string; scheduled_date: string }>();
        if (!dragged) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        const originDate = dragged.scheduled_date;
        if (originDate === targetDate) return json({ ok: true, moved: [] });

        const [year, month] = originDate.split("-").map(Number);
        const monthDates = buildMonthDates(year, month);
        if (!monthDates.includes(targetDate)) {
          // The UI never drags across a month boundary — this only fires
          // on a malformed/forged request.
          return json({ ok: false, error: "fuera_de_mes" }, { status: 400 });
        }

        const lo = Math.min(monthDates.indexOf(originDate), monthDates.indexOf(targetDate));
        const hi = Math.max(monthDates.indexOf(originDate), monthDates.indexOf(targetDate));
        const rangeDates = monthDates.slice(lo, hi + 1);

        const rows = await db()
          .prepare(
            `SELECT id, scheduled_date FROM calendar_entries
             WHERE user_id = ?1 AND slot_index = 1
               AND scheduled_date IN (${rangeDates.map((_, i) => `?${i + 2}`).join(",")})`,
          )
          .bind(user.id, ...rangeDates)
          .all<{ id: string; scheduled_date: string }>();
        const idByDate = new Map((rows.results ?? []).map((r) => [r.scheduled_date, r.id]));
        const occupied = new Set(idByDate.keys());

        const shift = computeReorderShift(monthDates, originDate, targetDate, occupied);
        const moves = [...shift.entries()].map(([from, to]) => ({
          id: from === originDate ? entryId : idByDate.get(from)!,
          to,
        }));

        // A piece already scheduled to actually publish at a real UTC time
        // (see calendar-entries-schedule.ts) has a commitment independent
        // of scheduled_date — silently shifting it to a new day would
        // desync the two without telling the client. Block the whole
        // reorder if ANY affected piece has one; they can cancel/
        // reschedule that publish first if they mean it.
        const affectedIds = moves.map((m) => m.id);
        const activeSchedule = await db()
          .prepare(
            `SELECT id FROM calendar_entry_schedules
             WHERE entry_id IN (${affectedIds.map((_, i) => `?${i + 2}`).join(",")})
               AND user_id = ?1 AND status IN ('scheduled', 'publishing')`,
          )
          .bind(user.id, ...affectedIds)
          .first();
        if (activeSchedule) {
          return json({ ok: false, error: "tiene_publicacion_programada" }, { status: 409 });
        }

        await db().batch(
          moves.map((m) =>
            db()
              .prepare(
                "UPDATE calendar_entries SET scheduled_date = ?2 WHERE id = ?1 AND user_id = ?3",
              )
              .bind(m.id, m.to, user.id),
          ),
        );

        return json({ ok: true, moved: moves });
      },
    },
  },
});
