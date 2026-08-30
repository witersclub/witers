// Shared server-only publisher for both an immediate client action and the
// Cloudflare cron. Keeping this here ensures scheduled delivery uses the
// exact same ownership, media, token and Meta integration path as "publish
// now" — never a browser-held token or a simulated success.
import { bindings } from "./bindings.server";
import { resolveCalendarEntryMedia } from "./calendar-entry-media.server";
import {
  createFacebookReel,
  createInstagramReel,
  publishCarouselToFacebookPage,
  publishCarouselToInstagram,
  publishImageToFacebookPage,
  publishImageToInstagram,
} from "./meta-publish.server";
import { decryptToken } from "./token-crypto.server";
import { db } from "./witers-auth.server";

export type SocialPlatform = "facebook" | "instagram";
export type PublishResult = {
  ok: boolean;
  processing?: boolean;
  externalPostId?: string;
  error?: string;
};

type ConnectionRow = {
  external_id: string;
  page_id: string;
  access_token: string;
  token_iv: string;
};

export async function publishCalendarEntry({
  entryId,
  userId,
  platforms,
  origin,
}: {
  entryId: string;
  userId: string;
  platforms: SocialPlatform[];
  origin: string;
}): Promise<{ ok: true; results: Record<SocialPlatform, PublishResult> } | { ok: false; error: string }> {
  const media = await resolveCalendarEntryMedia(entryId, userId);
  if (!media) return { ok: false, error: "no_encontrada" };
  if (media.status !== "lista") return { ok: false, error: "pieza_no_lista" };
  if (!media.caption) return { ok: false, error: "falta_copy" };
  if (media.items.length === 0) return { ok: false, error: "sin_contenido_entregado" };

  const publicMediaUrls = media.items.map(
    (item, index) =>
      item.imageUrl ??
      `${origin}/api/public/calendar-media?entryId=${entryId}&index=${index}`,
  );
  const results = {} as Record<SocialPlatform, PublishResult>;

  for (const platform of platforms) {
    const connection = await db()
      .prepare(
        "SELECT external_id, page_id, access_token, token_iv FROM social_connections WHERE user_id = ?1 AND platform = ?2",
      )
      .bind(userId, platform)
      .first<ConnectionRow>();

    if (!connection) {
      results[platform] = { ok: false, error: "no_conectado" };
      await recordPublication(entryId, platform, null, "no_conectado");
      continue;
    }

    const accessToken = await decryptToken(connection.access_token, connection.token_iv);
    if (media.format === "video") {
      const directVideo =
        platform === "facebook"
          ? await loadFacebookVideoFromR2(media.items[0]?.r2Key ?? null)
          : null;
      const started =
        platform === "instagram"
          ? await createInstagramReel(
              connection.external_id,
              accessToken,
              publicMediaUrls[0],
              media.caption,
            )
          : connection.page_id
            ? await createFacebookReel(
                connection.page_id,
                accessToken,
                publicMediaUrls[0],
                media.caption,
                directVideo,
              )
            : { ok: false as const, error: "pagina_no_disponible" };
      if (started.ok) {
        await recordVideoPublication(entryId, userId, platform, started.processingId);
        results[platform] = { ok: true, processing: true };
      } else {
        results[platform] = { ok: false, error: started.error };
        await recordVideoPublicationError(entryId, userId, platform, started.error);
      }
      continue;
    }

    const isCarousel = media.format === "carrusel";
    const result =
      platform === "instagram"
        ? isCarousel
          ? await publishCarouselToInstagram(
              connection.external_id,
              accessToken,
              publicMediaUrls,
              media.caption,
            )
          : await publishImageToInstagram(
              connection.external_id,
              accessToken,
              publicMediaUrls[0],
              media.caption,
            )
        : isCarousel
          ? await publishCarouselToFacebookPage(
              connection.page_id,
              accessToken,
              publicMediaUrls,
              media.caption,
            )
          : await publishImageToFacebookPage(
              connection.page_id,
              accessToken,
              publicMediaUrls[0],
              media.caption,
            );
    if (result.ok) {
      results[platform] = { ok: true, externalPostId: result.externalPostId };
      await recordPublication(entryId, platform, result.externalPostId, null);
    } else {
      results[platform] = { ok: false, error: result.error };
      await recordPublication(entryId, platform, null, result.error);
    }
  }

  return { ok: true, results };
}

async function loadFacebookVideoFromR2(
  r2Key: string | null,
): Promise<{ body: BodyInit; size: number } | null> {
  if (!r2Key) return null;
  const { STORAGE } = bindings();
  if (!STORAGE) return null;
  try {
    const object = await STORAGE.get(r2Key);
    return object ? { body: object.body as unknown as BodyInit, size: object.size } : null;
  } catch {
    return null;
  }
}

async function recordPublication(
  entryId: string,
  platform: SocialPlatform,
  externalPostId: string | null,
  error: string | null,
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO calendar_entry_publications (id, entry_id, platform, status, external_post_id, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(crypto.randomUUID(), entryId, platform, error ? "error" : "success", externalPostId, error)
    .run();
}

async function recordVideoPublication(
  entryId: string,
  userId: string,
  platform: SocialPlatform,
  processingId: string,
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO calendar_entry_video_publications
       (id, entry_id, user_id, platform, processing_id, status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'processing')`,
    )
    .bind(crypto.randomUUID(), entryId, userId, platform, processingId)
    .run();
}

async function recordVideoPublicationError(
  entryId: string,
  userId: string,
  platform: SocialPlatform,
  error: string,
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO calendar_entry_video_publications
       (id, entry_id, user_id, platform, processing_id, status, error, completed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'error', ?6, datetime('now'))`,
    )
    .bind(crypto.randomUUID(), entryId, userId, platform, "", error.slice(0, 1000))
    .run();
}
