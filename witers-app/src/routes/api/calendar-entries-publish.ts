import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  publishCalendarEntry,
  type SocialPlatform,
} from "../../lib/calendar-entry-publish.server";
import { resolveCalendarEntryMedia } from "../../lib/calendar-entry-media.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type PublicationRow = {
  platform: SocialPlatform;
  status: "success" | "error";
  external_post_id: string | null;
  error: string | null;
  published_at: string;
};
type VideoPublicationRow = {
  platform: SocialPlatform;
  status: "processing" | "success" | "error";
  external_post_id: string | null;
  error: string | null;
  created_at: string;
};

const schema = z.object({
  entryId: z.string().uuid(),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1).max(2),
});

// Immediate publishing remains an authenticated HTTP action. The exact same
// server-only publisher is also invoked by the scheduled Worker cron.
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

        const result = await publishCalendarEntry({
          entryId: parsed.data.entryId,
          userId: user.id,
          platforms: parsed.data.platforms,
          origin: new URL(request.url).origin,
        });
        return result.ok
          ? json(result)
          : json(result, { status: result.error === "no_encontrada" ? 404 : 409 });
      },
    },
  },
});
