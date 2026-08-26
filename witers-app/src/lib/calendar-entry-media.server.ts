// Resolves the delivered media for a single calendar entry — shared by the
// public media proxy (src/routes/api/public/calendar-media.ts) and the
// social-publish endpoint (src/routes/api/calendar-entries-publish.ts), so
// the "latest non-draft result" / "delivered carousel slides" / "delivered
// video" lookups aren't duplicated in three places. Mirrors the batched
// version of this same logic in calendar-entries.ts's GET (which stays
// batched there for the whole-month grid — this one resolves a single
// entry on demand instead).
import { db } from "./witers-auth.server";

export type CalendarFormat = "imagen" | "video" | "carrusel";
export type EntryStatus = "por_planear" | "en_diseno" | "lista";

const REQUEST_TABLE: Record<CalendarFormat, string> = {
  imagen: "design_requests",
  video: "video_requests",
  carrusel: "carousel_requests",
};

function statusBucket(requestStatus: string): "en_diseno" | "lista" {
  return requestStatus === "completada" || requestStatus === "cerrada" ? "lista" : "en_diseno";
}

// r2Key needs /api/file (private) or /api/public/calendar-media (public) to
// serve; imageUrl (only ever set for "imagen", AI-generated deliverables)
// is already a public CDN URL and should be used as-is when present.
export type MediaItem = { r2Key: string | null; imageUrl: string | null };

export type ResolvedEntryMedia = {
  entryId: string;
  userId: string;
  format: CalendarFormat;
  status: EntryStatus;
  caption: string | null;
  items: MediaItem[]; // delivered media in order — [] unless status is "lista"
};

// Pass userId to scope the lookup to that owner (the normal, session-backed
// case). Pass null only from an unauthenticated public route — callers
// doing that must still gate on `status === "lista"` themselves before
// serving anything, the same trust model showcase-image.ts already uses.
export async function resolveCalendarEntryMedia(
  entryId: string,
  userId: string | null,
): Promise<ResolvedEntryMedia | null> {
  const entry = userId
    ? await db()
        .prepare(
          "SELECT id, user_id, format, request_id, caption FROM calendar_entries WHERE id = ?1 AND user_id = ?2",
        )
        .bind(entryId, userId)
        .first<{
          id: string;
          user_id: string;
          format: CalendarFormat;
          request_id: string | null;
          caption: string | null;
        }>()
    : await db()
        .prepare(
          "SELECT id, user_id, format, request_id, caption FROM calendar_entries WHERE id = ?1",
        )
        .bind(entryId)
        .first<{
          id: string;
          user_id: string;
          format: CalendarFormat;
          request_id: string | null;
          caption: string | null;
        }>();
  if (!entry) return null;

  if (!entry.request_id) {
    return {
      entryId,
      userId: entry.user_id,
      format: entry.format,
      status: "por_planear",
      caption: entry.caption,
      items: [],
    };
  }

  const statusRow = await db()
    .prepare(`SELECT status FROM ${REQUEST_TABLE[entry.format]} WHERE id = ?1`)
    .bind(entry.request_id)
    .first<{ status: string }>();
  const status = statusRow ? statusBucket(statusRow.status) : "en_diseno";
  if (status !== "lista") {
    return {
      entryId,
      userId: entry.user_id,
      format: entry.format,
      status,
      caption: entry.caption,
      items: [],
    };
  }

  let items: MediaItem[] = [];
  if (entry.format === "imagen") {
    const row = await db()
      .prepare(
        `SELECT image_url, r2_key FROM request_results
         WHERE request_id = ?1 AND kind != 'draft'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(entry.request_id)
      .first<{ image_url: string | null; r2_key: string | null }>();
    if (row?.image_url || row?.r2_key) {
      items = [{ imageUrl: row.image_url, r2Key: row.r2_key }];
    }
  } else if (entry.format === "carrusel") {
    const rows = await db()
      .prepare(
        `SELECT delivered_key FROM carousel_slides
         WHERE carousel_request_id = ?1 AND delivered_key IS NOT NULL
         ORDER BY slide_index ASC`,
      )
      .bind(entry.request_id)
      .all<{ delivered_key: string }>();
    items = (rows.results ?? []).map((r) => ({ r2Key: r.delivered_key, imageUrl: null }));
  } else {
    const row = await db()
      .prepare(
        "SELECT delivered_key FROM video_requests WHERE id = ?1 AND delivered_key IS NOT NULL",
      )
      .bind(entry.request_id)
      .first<{ delivered_key: string }>();
    if (row?.delivered_key) items = [{ r2Key: row.delivered_key, imageUrl: null }];
  }

  return {
    entryId,
    userId: entry.user_id,
    format: entry.format,
    status,
    caption: entry.caption,
    items,
  };
}
