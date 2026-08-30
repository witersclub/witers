import { publishCalendarEntry, type SocialPlatform } from "./calendar-entry-publish.server";
import { db } from "./witers-auth.server";

type DueSchedule = {
  id: string;
  entry_id: string;
  user_id: string;
  platforms_json: string;
  attempt_count: number;
};
type VideoStatusRow = {
  platform: SocialPlatform;
  status: "processing" | "success" | "error";
  error: string | null;
  external_post_id: string | null;
};

const MAX_RETRIES = 3;
const WITERS_ORIGIN = "https://witers.com";

function isRecoverable(error: string | undefined): boolean {
  return Boolean(error && /(timeout|network|rate|temporar|unavailable|5\d\d)/i.test(error));
}

// Cloudflare invokes this every minute. D1 claims each due schedule before a
// Meta call, making duplicate executions harmless even if two cron invocations
// overlap. The database remains the source of truth if a browser is closed.
export async function processDueCalendarSchedules(): Promise<void> {
  const due = await db()
    .prepare(
      `SELECT id, entry_id, user_id, platforms_json, attempt_count
       FROM calendar_entry_schedules
       WHERE status = 'scheduled'
         AND COALESCE(next_attempt_at, scheduled_for_utc) <= datetime('now')
       ORDER BY COALESCE(next_attempt_at, scheduled_for_utc) ASC
       LIMIT 10`,
    )
    .all<DueSchedule>();

  for (const schedule of due.results ?? []) {
    const claim = await db()
      .prepare(
        `UPDATE calendar_entry_schedules
         SET status = 'publishing', attempt_count = attempt_count + 1,
             last_attempt_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?1 AND status = 'scheduled'`,
      )
      .bind(schedule.id)
      .run();
    if (!claim.meta.changes) continue;

    let platforms: SocialPlatform[];
    try {
      platforms = JSON.parse(schedule.platforms_json) as SocialPlatform[];
    } catch {
      await finishSchedule(schedule.id, "error", null, "plataformas_invalidas");
      continue;
    }

    try {
      const result = await publishCalendarEntry({
        entryId: schedule.entry_id,
        userId: schedule.user_id,
        platforms,
        origin: WITERS_ORIGIN,
      });
      if (!result.ok) {
        await retryOrFail(schedule, result.error);
        continue;
      }
      const outcomes = Object.values(result.results);
      const hasProcessing = outcomes.some((outcome) => outcome.processing);
      const successful = outcomes.filter((outcome) => outcome.ok).length;
      const errors = outcomes
        .filter((outcome) => !outcome.ok)
        .map((outcome) => outcome.error)
        .filter(Boolean)
        .join(" · ");
      if (hasProcessing) {
        await finishSchedule(schedule.id, "publishing", result.results, errors || null);
      } else if (successful === outcomes.length) {
        await finishSchedule(schedule.id, "published", result.results, null);
      } else if (successful > 0) {
        await finishSchedule(schedule.id, "partial", result.results, errors || null);
      } else {
        await retryOrFail(schedule, errors || "publicacion_fallida", result.results);
      }
    } catch (error) {
      await retryOrFail(schedule, error instanceof Error ? error.message : "publicacion_fallida");
    }
  }

  // Video publishing has its own asynchronous Meta lifecycle. Once all its
  // platform operations settle, bring the parent schedule to a final state.
  await finalizeProcessingVideoSchedules();
}

async function retryOrFail(
  schedule: DueSchedule,
  error: string,
  results: unknown = null,
): Promise<void> {
  const retry = schedule.attempt_count + 1 < MAX_RETRIES && isRecoverable(error);
  if (retry) {
    await db()
      .prepare(
        `UPDATE calendar_entry_schedules
         SET status = 'scheduled', last_error = ?2,
             next_attempt_at = datetime('now', '+5 minutes'), results_json = ?3,
             updated_at = datetime('now') WHERE id = ?1`,
      )
      .bind(schedule.id, error.slice(0, 1000), results ? JSON.stringify(results) : null)
      .run();
    return;
  }
  await finishSchedule(schedule.id, "error", results, error);
}

async function finishSchedule(
  id: string,
  status: "publishing" | "published" | "partial" | "error",
  results: unknown,
  error: string | null,
): Promise<void> {
  await db()
    .prepare(
      `UPDATE calendar_entry_schedules
       SET status = ?2, results_json = ?3, last_error = ?4,
           published_at = CASE WHEN ?2 IN ('published', 'partial') THEN datetime('now') ELSE published_at END,
           updated_at = datetime('now') WHERE id = ?1`,
    )
    .bind(id, status, results ? JSON.stringify(results) : null, error?.slice(0, 1000) ?? null)
    .run();
}

async function finalizeProcessingVideoSchedules(): Promise<void> {
  const rows = await db()
    .prepare(
      `SELECT s.id, s.entry_id, s.platforms_json
       FROM calendar_entry_schedules s
       WHERE s.status = 'publishing' LIMIT 20`,
    )
    .all<{ id: string; entry_id: string; platforms_json: string }>();
  for (const row of rows.results ?? []) {
    const videoRows = await db()
      .prepare(
        `SELECT platform, status, error, external_post_id
         FROM calendar_entry_video_publications WHERE entry_id = ?1 ORDER BY created_at DESC`,
      )
      .bind(row.entry_id)
      .all<VideoStatusRow>();
    const platforms = JSON.parse(row.platforms_json) as SocialPlatform[];
    const latest = new Map<SocialPlatform, VideoStatusRow>();
    for (const publication of videoRows.results ?? []) {
      if (!latest.has(publication.platform)) latest.set(publication.platform, publication);
    }
    if (platforms.some((platform) => latest.get(platform)?.status === "processing")) continue;
    if (platforms.some((platform) => !latest.get(platform))) continue;
    const values = platforms.map((platform) => latest.get(platform)!);
    const successCount = values.filter((value) => value.status === "success").length;
    await finishSchedule(
      row.id,
      successCount === values.length ? "published" : successCount ? "partial" : "error",
      Object.fromEntries(values.map((value) => [value.platform, value])),
      values.filter((value) => value.error).map((value) => value.error).join(" · ") || null,
    );
  }
}
