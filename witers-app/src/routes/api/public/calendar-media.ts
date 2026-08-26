import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { resolveCalendarEntryMedia } from "../../../lib/calendar-entry-media.server";
import { json } from "../../../lib/witers-auth.server";

// Public, unauthenticated media proxy — Meta's servers fetch the piece to
// publish from here, and they can't authenticate against /api/file (which
// requires the owning client's session). Same trust model as
// showcase-image.ts: no signed token, just re-deriving the R2 key from the
// database on every request and refusing to serve anything unless the
// entry's own status is independently "lista" — a client can only reach
// this by already knowing the entry's random UUID.
export const Route = createFileRoute("/api/public/calendar-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const entryId = url.searchParams.get("entryId") ?? "";
        const index = Number(url.searchParams.get("index") ?? "0");
        if (!entryId || !Number.isInteger(index) || index < 0) {
          return json({ ok: false, error: "parametros_invalidos" }, { status: 400 });
        }

        const media = await resolveCalendarEntryMedia(entryId, null);
        if (!media || media.status !== "lista") {
          return json({ ok: false, error: "no_encontrado" }, { status: 404 });
        }

        const item = media.items[index];
        if (!item?.r2Key) {
          return json({ ok: false, error: "no_encontrado" }, { status: 404 });
        }

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const obj = await STORAGE.get(item.r2Key);
        if (!obj) return json({ ok: false, error: "no_encontrado" }, { status: 404 });

        return new Response(obj.body as unknown as BodyInit, {
          headers: {
            "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
