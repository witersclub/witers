import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { bindings } from "../../lib/bindings.server";
import { resolveCalendarEntryMedia } from "../../lib/calendar-entry-media.server";
import {
  createFacebookReel,
  createInstagramReel,
  publishCarouselToFacebookPage,
  publishCarouselToInstagram,
  publishImageToFacebookPage,
  publishImageToInstagram,
} from "../../lib/meta-publish.server";
import { decryptToken } from "../../lib/token-crypto.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type Platform = "facebook" | "instagram";
type ConnectionRow = {
  external_id: string;
  page_id: string;
  access_token: string;
  token_iv: string;
};
type PublicationRow = {
  platform: Platform;
  status: "success" | "error";
  external_post_id: string | null;
  error: string | null;
  published_at: string;
};
type VideoPublicationRow = {
  platform: Platform;
  status: "processing" | "success" | "error";
  external_post_id: string | null;
  error: string | null;
  created_at: string;
};

const schema = z.object({
  entryId: z.string().uuid(),
  platforms: z
    .array(z.enum(["facebook", "instagram"]))
    .min(1)
    .max(2),
});

// Publishes an already-delivered imagen/carrusel piece straight to the
// client's connected Instagram/Facebook — one attempt per requested
// platform, each recorded as its own row in calendar_entry_publications
// (never overwritten) so a retry after a failure keeps history. Video uses a
// separate persisted operation; the Worker cron completes it after Meta has
// fetched and encoded the reel.
export const Route = createFileRoute("/api/calendar-entries-publish")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const entryId = new URL(request.url).searchParams.get("entryId") ?? "";
        const media = await resolveCalendarEntryMedia(entryId, user.id);
        if (!media) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        const rows = await db()
          .prepare(
            `SELECT platform, status, external_post_id, error, published_at
             FROM calendar_entry_publications WHERE entry_id = ?1 ORDER BY published_at DESC`,
          )
          .bind(entryId)
          .all<PublicationRow>();

        const videoRows = await db()
          .prepare(
            `SELECT platform, status, external_post_id, error, created_at
             FROM calendar_entry_video_publications
             WHERE entry_id = ?1 ORDER BY created_at DESC`,
          )
          .bind(entryId)
          .all<VideoPublicationRow>();

        return json({
          ok: true,
          publications: rows.results ?? [],
          videoPublications: videoRows.results ?? [],
        });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const { entryId, platforms } = parsed.data;

        const media = await resolveCalendarEntryMedia(entryId, user.id);
        if (!media) return json({ ok: false, error: "no_encontrada" }, { status: 404 });
        if (media.status !== "lista") {
          return json({ ok: false, error: "pieza_no_lista" }, { status: 409 });
        }
        if (!media.caption) {
          return json({ ok: false, error: "falta_copy" }, { status: 409 });
        }
        if (media.items.length === 0) {
          return json({ ok: false, error: "sin_contenido_entregado" }, { status: 409 });
        }

        const url = new URL(request.url);
        const publicMediaUrls = media.items.map(
          (item, index) =>
            item.imageUrl ??
            `${url.origin}/api/public/calendar-media?entryId=${entryId}&index=${index}`,
        );

        const results: Record<
          string,
          { ok: boolean; processing?: boolean; externalPostId?: string; error?: string }
        > = {};

        for (const platform of platforms) {
          const connection = await db()
            .prepare(
              "SELECT external_id, page_id, access_token, token_iv FROM social_connections WHERE user_id = ?1 AND platform = ?2",
            )
            .bind(user.id, platform)
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
              await recordVideoPublication(entryId, user.id, platform, started.processingId);
              results[platform] = { ok: true, processing: true };
            } else {
              results[platform] = { ok: false, error: started.error };
              await recordVideoPublicationError(entryId, user.id, platform, started.error);
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

        return json({ ok: true, results });
      },
    },
  },
});

async function loadFacebookVideoFromR2(
  r2Key: string | null,
): Promise<{ body: BodyInit; size: number } | null> {
  if (!r2Key) {
    console.info("[meta-publish] Facebook direct upload has no R2 key");
    return null;
  }
  const { STORAGE } = bindings();
  if (!STORAGE) {
    console.info("[meta-publish] Facebook direct upload has no R2 binding");
    return null;
  }
  try {
    const object = await STORAGE.get(r2Key);
    if (!object) {
      console.info("[meta-publish] Facebook direct upload R2 object missing");
      return null;
    }
    console.info("[meta-publish] Facebook direct upload R2 object ready", object.size);
    return { body: object.body as unknown as BodyInit, size: object.size };
  } catch {
    console.info("[meta-publish] Facebook direct upload R2 read failed");
    return null;
  }
}

async function recordPublication(
  entryId: string,
  platform: Platform,
  externalPostId: string | null,
  error: string | null,
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO calendar_entry_publications (id, entry_id, platform, status, external_post_id, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      crypto.randomUUID(),
      entryId,
      platform,
      error ? "error" : "success",
      externalPostId,
      error,
    )
    .run();
}

async function recordVideoPublication(
  entryId: string,
  userId: string,
  platform: Platform,
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
  platform: Platform,
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
