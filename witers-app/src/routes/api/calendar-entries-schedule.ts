import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { resolveCalendarEntryMedia } from "../../lib/calendar-entry-media.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const platformsSchema = z.array(z.enum(["facebook", "instagram"])).min(1).max(2);
const scheduleSchema = z.object({
  entryId: z.string().uuid(),
  scheduledForUtc: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(100),
  platforms: platformsSchema,
  // Only supplied when the client explicitly reprograms an expired calendar
  // date. Current planned dates otherwise remain untouched.
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const updateSchema = scheduleSchema.partial().extend({ entryId: z.string().uuid() });

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

async function connectedIds(userId: string, platforms: string[]): Promise<string[] | null> {
  const rows = await db()
    .prepare(
      `SELECT id, platform FROM social_connections
       WHERE user_id = ?1 AND platform IN (${platforms.map((_, index) => `?${index + 2}`).join(",")})`,
    )
    .bind(userId, ...platforms)
    .all<{ id: string; platform: string }>();
  return rows.results?.length === platforms.length ? rows.results.map((row) => row.id) : null;
}

async function validateSchedule(
  userId: string,
  input: { entryId: string; scheduledForUtc: string; timezone: string; platforms: string[] },
): Promise<{ connectionIds: string[] } | { error: string }> {
  const due = Date.parse(input.scheduledForUtc);
  if (!Number.isFinite(due) || due <= Date.now()) return { error: "fecha_pasada" };
  if (!isValidTimezone(input.timezone)) return { error: "zona_horaria_invalida" };
  const media = await resolveCalendarEntryMedia(input.entryId, userId);
  if (!media) return { error: "no_encontrada" };
  if (media.status !== "lista") return { error: "pieza_no_lista" };
  if (!media.caption) return { error: "falta_copy" };
  if (media.items.length === 0) return { error: "sin_contenido_entregado" };
  const connectionIds = await connectedIds(userId, input.platforms);
  return connectionIds ? { connectionIds } : { error: "red_no_conectada" };
}

export const Route = createFileRoute("/api/calendar-entries-schedule")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const entryId = new URL(request.url).searchParams.get("entryId") ?? "";
        const schedule = await db()
          .prepare(
            `SELECT id, scheduled_for_utc, timezone, platforms_json, status, attempt_count,
                    last_attempt_at, last_error, published_at, results_json
             FROM calendar_entry_schedules WHERE entry_id = ?1 AND user_id = ?2`,
          )
          .bind(entryId, user.id)
          .first();
        return json({ ok: true, schedule });
      },
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const valid = await validateSchedule(user.id, parsed.data);
        if ("error" in valid) return json({ ok: false, error: valid.error }, { status: 409 });

        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO calendar_entry_schedules
             (id, entry_id, user_id, scheduled_for_utc, timezone, platforms_json, connection_ids_json, status)
             VALUES (?1, ?2, ?3, datetime(?4), ?5, ?6, ?7, 'scheduled')
             ON CONFLICT(entry_id) DO UPDATE SET
               scheduled_for_utc = excluded.scheduled_for_utc,
               timezone = excluded.timezone, platforms_json = excluded.platforms_json,
               connection_ids_json = excluded.connection_ids_json, status = 'scheduled',
               attempt_count = 0, last_attempt_at = NULL, next_attempt_at = NULL,
               last_error = NULL, published_at = NULL, results_json = NULL,
               updated_at = datetime('now')`,
          )
          .bind(
            id,
            parsed.data.entryId,
            user.id,
            parsed.data.scheduledForUtc,
            parsed.data.timezone,
            JSON.stringify(parsed.data.platforms),
            JSON.stringify(valid.connectionIds),
          )
          .run();
        if (parsed.data.plannedDate) {
          await db()
            .prepare(`UPDATE calendar_entries SET scheduled_date = ?3 WHERE id = ?1 AND user_id = ?2`)
            .bind(parsed.data.entryId, user.id, parsed.data.plannedDate)
            .run();
        }
        return json({ ok: true });
      },
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = updateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || !parsed.data.scheduledForUtc || !parsed.data.timezone || !parsed.data.platforms) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const valid = await validateSchedule(user.id, parsed.data as z.infer<typeof scheduleSchema>);
        if ("error" in valid) return json({ ok: false, error: valid.error }, { status: 409 });
        const result = await db()
          .prepare(
            `UPDATE calendar_entry_schedules
             SET scheduled_for_utc = datetime(?3), timezone = ?4, platforms_json = ?5,
                 connection_ids_json = ?6, status = 'scheduled', attempt_count = 0,
                 last_attempt_at = NULL, next_attempt_at = NULL, last_error = NULL,
                 published_at = NULL, results_json = NULL, updated_at = datetime('now')
             WHERE entry_id = ?1 AND user_id = ?2`,
          )
          .bind(
            parsed.data.entryId,
            user.id,
            parsed.data.scheduledForUtc,
            parsed.data.timezone,
            JSON.stringify(parsed.data.platforms),
            JSON.stringify(valid.connectionIds),
          )
          .run();
        return result.meta.changes
          ? json({ ok: true })
          : json({ ok: false, error: "no_programada" }, { status: 404 });
      },
      DELETE: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const entryId = new URL(request.url).searchParams.get("entryId") ?? "";
        const result = await db()
          .prepare(
            `UPDATE calendar_entry_schedules SET status = 'canceled', updated_at = datetime('now')
             WHERE entry_id = ?1 AND user_id = ?2 AND status = 'scheduled'`,
          )
          .bind(entryId, user.id)
          .run();
        return result.meta.changes
          ? json({ ok: true })
          : json({ ok: false, error: "no_programada" }, { status: 409 });
      },
    },
  },
});
