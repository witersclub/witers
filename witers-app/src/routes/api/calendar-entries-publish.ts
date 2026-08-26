import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { resolveCalendarEntryMedia } from "../../lib/calendar-entry-media.server";
import {
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
// (never overwritten) so a retry after a failure keeps history. Video is
// rejected here: Meta's video publish flow is async (upload → poll until
// FINISHED → publish), which doesn't fit a single Worker request without a
// job queue this project doesn't have — deliberately out of v1.
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

        return json({ ok: true, publications: rows.results ?? [] });
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
        if (media.format === "video") {
          return json({ ok: false, error: "video_no_soportado" }, { status: 409 });
        }
        if (!media.caption) {
          return json({ ok: false, error: "falta_copy" }, { status: 409 });
        }
        if (media.items.length === 0) {
          return json({ ok: false, error: "sin_contenido_entregado" }, { status: 409 });
        }

        const url = new URL(request.url);
        const imageUrls = media.items.map(
          (item, index) =>
            item.imageUrl ??
            `${url.origin}/api/public/calendar-media?entryId=${entryId}&index=${index}`,
        );

        const results: Record<string, { ok: boolean; externalPostId?: string; error?: string }> =
          {};

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
          const isCarousel = media.format === "carrusel";
          const result =
            platform === "instagram"
              ? isCarousel
                ? await publishCarouselToInstagram(
                    connection.external_id,
                    accessToken,
                    imageUrls,
                    media.caption,
                  )
                : await publishImageToInstagram(
                    connection.external_id,
                    accessToken,
                    imageUrls[0],
                    media.caption,
                  )
              : isCarousel
                ? await publishCarouselToFacebookPage(
                    connection.page_id,
                    accessToken,
                    imageUrls,
                    media.caption,
                  )
                : await publishImageToFacebookPage(
                    connection.page_id,
                    accessToken,
                    imageUrls[0],
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
