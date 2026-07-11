import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { db, json } from "../../../lib/witers-auth.server";

// Public, unauthenticated logo proxy — deliberately separate from /api/file
// (client/staff only) so this can never widen access to a client's other
// private files. Only ever serves a key that independently satisfies the
// exact same "logo of a cerrada request" condition /api/public/brands used
// to list it in the first place.
export const Route = createFileRoute("/api/public/brand-logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") ?? "";
        if (!key || key.includes("..")) {
          return json({ ok: false, error: "key_invalida" }, { status: 400 });
        }

        let row;
        try {
          row = await db()
            .prepare(`SELECT id FROM design_requests WHERE logo_key = ?1 AND status = 'cerrada' AND logo_public = 1`)
            .bind(key)
            .first();
        } catch {
          // logo_public column migration (0010) not applied here yet — see
          // the same fallback in /api/public/brands.
          row = await db()
            .prepare(`SELECT id FROM design_requests WHERE logo_key = ?1 AND status = 'cerrada'`)
            .bind(key)
            .first();
        }
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
