import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../lib/bindings.server";
import {
  db,
  getSessionUser,
  json,
  requireAdminUser,
} from "../../lib/witers-auth.server";

// Serves R2 objects (member reference uploads + admin deliverables).
// Access: the member who owns the related request, or a platform (admin) user.
export const Route = createFileRoute("/api/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") ?? "";
        if (!key || key.includes("..")) {
          return json({ ok: false, error: "key_invalida" }, { status: 400 });
        }

        const member = await getSessionUser(request);
        let allowed = false;

        if (member) {
          if (key.startsWith(`refs/${member.id}/`)) {
            allowed = true;
          } else if (key.startsWith("deliveries/")) {
            const row = await db()
              .prepare(
                `SELECT r.user_id FROM request_results res
                 JOIN design_requests r ON r.id = res.request_id
                 WHERE res.r2_key = ?1`,
              )
              .bind(key)
              .first<{ user_id: string }>();
            allowed = row?.user_id === member.id;
          }
        }

        if (!allowed) {
          const admin = await requireAdminUser(request);
          allowed = admin.ok;
        }
        if (!allowed) return json({ ok: false, error: "no_autorizado" }, { status: 403 });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const obj = await STORAGE.get(key);
        if (!obj) return json({ ok: false, error: "no_encontrado" }, { status: 404 });

        return new Response(obj.body as unknown as BodyInit, {
          headers: {
            "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "private, max-age=300",
          },
        });
      },
    },
  },
});

