import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  entryId: z.string().uuid(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetSlot: z.union([z.literal(1), z.literal(2)]).default(1),
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// CAMBIO 03 — drag & drop on the planning calendar. Deliberately separate
// from the PATCH on /api/calendar-entries: that one only edits a piece's
// own content (title/brief/slides) and refuses once request_id is set —
// exactly the guard that should NOT apply here. The date is the fixed
// slot; the piece is what moves, in any production status (por_planear/
// en_diseno/lista) — its status travels with it for free, since status
// lives on the entry row itself, never on the date.
export const Route = createFileRoute("/api/calendar-entries-move")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const { entryId, targetDate, targetSlot } = parsed.data;

        if (targetDate < todayIso()) {
          return json({ ok: false, error: "fecha_pasada" }, { status: 409 });
        }

        const dragged = await db()
          .prepare(
            "SELECT id, scheduled_date, slot_index FROM calendar_entries WHERE id = ?1 AND user_id = ?2",
          )
          .bind(entryId, user.id)
          .first<{ id: string; scheduled_date: string; slot_index: number }>();
        if (!dragged) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        if (dragged.scheduled_date === targetDate && dragged.slot_index === targetSlot) {
          return json({ ok: true, swapped: false });
        }

        const other = await db()
          .prepare(
            `SELECT id FROM calendar_entries
             WHERE user_id = ?1 AND scheduled_date = ?2 AND slot_index = ?3 AND id != ?4`,
          )
          .bind(user.id, targetDate, targetSlot, entryId)
          .first<{ id: string }>();

        // A piece already scheduled to actually publish at a real UTC time
        // (see calendar-entries-schedule.ts) has a commitment independent
        // of scheduled_date — silently dragging it to a new day would
        // desync the two without telling the client. Block it instead;
        // they can cancel/reschedule the publish first if they mean it.
        // Checked for BOTH sides of a swap — the piece landing in the
        // dragged piece's old slot has its date changed too, not just the
        // one being dragged.
        const affectedIds = other ? [entryId, other.id] : [entryId];
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

        if (other) {
          // Swap: both rows change in one atomic batch so a concurrent read
          // (or a second move firing mid-flight) never sees only one side
          // of the exchange applied.
          await db().batch([
            db()
              .prepare(
                "UPDATE calendar_entries SET scheduled_date = ?2, slot_index = ?3 WHERE id = ?1 AND user_id = ?4",
              )
              .bind(other.id, dragged.scheduled_date, dragged.slot_index, user.id),
            db()
              .prepare(
                "UPDATE calendar_entries SET scheduled_date = ?2, slot_index = ?3 WHERE id = ?1 AND user_id = ?4",
              )
              .bind(entryId, targetDate, targetSlot, user.id),
          ]);
          return json({ ok: true, swapped: true, otherEntryId: other.id });
        }

        await db()
          .prepare(
            "UPDATE calendar_entries SET scheduled_date = ?2, slot_index = ?3 WHERE id = ?1 AND user_id = ?4",
          )
          .bind(entryId, targetDate, targetSlot, user.id)
          .run();
        return json({ ok: true, swapped: false });
      },
    },
  },
});
