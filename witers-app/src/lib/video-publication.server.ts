import {
  checkFacebookReel,
  checkInstagramReel,
  publishInstagramReel,
} from "./meta-publish.server";
import { decryptToken } from "./token-crypto.server";
import { db } from "./witers-auth.server";

type PendingVideoPublication = {
  id: string;
  platform: "facebook" | "instagram";
  processing_id: string;
  external_id: string | null;
  page_id: string | null;
  access_token: string | null;
  token_iv: string | null;
};

// One poll per minute is deliberately conservative: Meta recommends polling
// video containers sparingly, and this keeps the Worker below its request and
// CPU limits while still finishing typical reels quickly.
export async function processPendingVideoPublications(): Promise<void> {
  const rows = await db()
    .prepare(
      `SELECT p.id, p.platform, p.processing_id,
              c.external_id, c.page_id, c.access_token, c.token_iv
       FROM calendar_entry_video_publications p
       LEFT JOIN social_connections c ON c.user_id = p.user_id AND c.platform = p.platform
       WHERE p.status = 'processing'
       ORDER BY p.created_at ASC
       LIMIT 20`,
    )
    .all<PendingVideoPublication>();

  for (const row of rows.results ?? []) {
    try {
      if (!row.access_token || !row.token_iv || !row.external_id) {
        await markVideoPublicationError(row.id, "cuenta_desconectada");
        continue;
      }
      const accessToken = await decryptToken(row.access_token, row.token_iv);
      if (row.platform === "instagram") {
        const status = await checkInstagramReel(row.processing_id, accessToken);
        if (status.state === "ready") {
          const published = await publishInstagramReel(row.external_id, accessToken, row.processing_id);
          if (published.ok) await markVideoPublicationSuccess(row.id, published.externalPostId);
          else await markVideoPublicationError(row.id, published.error);
        } else if (status.state === "success") {
          await markVideoPublicationSuccess(row.id, status.externalPostId);
        } else if (status.state === "error") {
          await markVideoPublicationError(row.id, status.error);
        }
      } else {
        const status = await checkFacebookReel(row.processing_id, accessToken);
        if (status.state === "success") {
          await markVideoPublicationSuccess(row.id, status.externalPostId);
        } else if (status.state === "error") {
          await markVideoPublicationError(row.id, status.error);
        }
      }
    } catch (error) {
      console.error("[video-publication] pending operation failed", row.id, error);
      // A transient Worker/Meta failure is retried by the next cron run; only
      // explicit API errors above turn a publication into a permanent error.
    }
  }
}

export async function markVideoPublicationSuccess(id: string, externalPostId: string): Promise<void> {
  await db()
    .prepare(
      `UPDATE calendar_entry_video_publications
       SET status = 'success', external_post_id = ?2, error = NULL,
           updated_at = datetime('now'), completed_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(id, externalPostId)
    .run();
}

export async function markVideoPublicationError(id: string, error: string): Promise<void> {
  await db()
    .prepare(
      `UPDATE calendar_entry_video_publications
       SET status = 'error', error = ?2, updated_at = datetime('now'),
           completed_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(id, error.slice(0, 1000))
    .run();
}
