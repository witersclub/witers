import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { db, json } from "../../../lib/witers-auth.server";

// Public, unauthenticated image proxy for the homepage showcase — deliberately
// separate from /api/file (which requires the owning client or staff) so this
// endpoint can never be used to widen access to a client's private files. It
// only ever serves a key that independently satisfies the exact same
// "latest non-draft result of a cerrada request" condition /api/public/showcase
// used to list it in the first place.
export const Route = createFileRoute("/api/public/showcase-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") ?? "";
        if (!key || key.includes("..")) {
          return json({ ok: false, error: "key_invalida" }, { status: 400 });
        }

        const row = await db()
          .prepare(
            `SELECT res.id
             FROM request_results res
             JOIN design_requests r ON r.id = res.request_id
             WHERE res.r2_key = ?1
               AND r.status = 'cerrada'
               AND res.kind != 'draft'
               AND res.id = (
                 SELECT id FROM request_results
                 WHERE request_id = r.id AND kind != 'draft'
                 ORDER BY created_at DESC LIMIT 1
               )`,
          )
          .bind(key)
          .first();
        if (!row) return json({ ok: false, error: "no_autorizado" }, { status: 403 });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const obj = await STORAGE.get(key);
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
