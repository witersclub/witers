import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../lib/bindings.server";
import {
  db,
  getSessionUser,
  json,
  requireStaffUser,
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
            // The owning client can only ever reach the latest delivery for
            // a request — never an older, superseded version (those are
            // dropped from both the API response and here). That's the
            // actual "one final design per request" enforcement; once it's
            // the current delivery, the client can view and download it as
            // many times as they want, whether the request is still
            // "completada" or already "cerrada" — it's the same single file
            // either way.
            const row = await db()
              .prepare(
                `SELECT r.user_id, r.status,
                   (res.id = (
                     SELECT id FROM request_results
                     WHERE request_id = r.id AND kind != 'draft'
                     ORDER BY created_at DESC LIMIT 1
                   )) AS is_latest
                 FROM request_results res
                 JOIN design_requests r ON r.id = res.request_id
                 WHERE res.r2_key = ?1`,
              )
              .bind(key)
              .first<{ user_id: string; status: string; is_latest: number }>();
            allowed =
              row?.user_id === member.id &&
              row.is_latest === 1 &&
              (row.status === "completada" || row.status === "cerrada");
          }
        }

        if (!allowed) {
          const staff = await requireStaffUser(request);
          allowed = staff.ok;
        }
        if (!allowed) return json({ ok: false, error: "no_autorizado" }, { status: 403 });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const obj = await STORAGE.get(key);
        if (!obj) return json({ ok: false, error: "no_encontrado" }, { status: 404 });

        const headers: Record<string, string> = {
          "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "private, max-age=300",
        };
        if (url.searchParams.get("download") === "1") {
          const filename = key.split("/").pop() ?? "archivo";
          headers["content-disposition"] = `attachment; filename="${filename}"`;
        }

        return new Response(obj.body as unknown as BodyInit, { headers });
      },
    },
  },
});

