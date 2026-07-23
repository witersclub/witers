import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../lib/bindings.server";
import { db, getSessionUser, json, requireStaffUser } from "../../lib/witers-auth.server";

// Turns a request title into a safe, readable filename segment — accents
// stripped (not every OS/zip tool handles UTF-8 filenames well), anything
// that isn't alphanumeric collapsed to a single underscore.
function slugifyFilenamePart(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "Pieza";
}

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
        // Set whenever `key` is a delivered piece, regardless of who's
        // downloading — used below to build "WITERS_Título_03.ext" instead
        // of the raw R2 key as the saved filename, for staff downloads too.
        let delivery: { title: string; clientSeq: number } | null = null;

        if (key.startsWith("deliveries/")) {
          // The owning client can only ever reach the latest delivery for a
          // request — never an older, superseded version (those are dropped
          // from both the API response and here). That's the actual "one
          // final design per request" enforcement; once it's the current
          // delivery, the client can view and download it as many times as
          // they want, whether the request is still "completada" or already
          // "cerrada" — it's the same single file either way.
          // client_seq: this client's Nth request ever, chronologically —
          // the "número de referencia" a client asked to see baked into the
          // downloaded filename. Computed on the fly (no stored sequence
          // column) since it's simple, always in sync, and correct for
          // every request already in the database, not just new ones.
          const row = await db()
            .prepare(
              `SELECT r.user_id, r.status, r.title,
                 (res.id = (
                   SELECT id FROM request_results
                   WHERE request_id = r.id AND kind != 'draft'
                   ORDER BY created_at DESC LIMIT 1
                 )) AS is_latest,
                 (SELECT COUNT(*) FROM design_requests d2
                  WHERE d2.user_id = r.user_id AND d2.created_at <= r.created_at) AS client_seq
               FROM request_results res
               JOIN design_requests r ON r.id = res.request_id
               WHERE res.r2_key = ?1`,
            )
            .bind(key)
            .first<{
              user_id: string;
              status: string;
              title: string;
              is_latest: number;
              client_seq: number;
            }>();
          if (row) {
            delivery = { title: row.title, clientSeq: row.client_seq };
            if (member) {
              allowed =
                row.user_id === member.id &&
                row.is_latest === 1 &&
                (row.status === "completada" ||
                  row.status === "cerrada" ||
                  row.status === "cambio_solicitado");
            }
          }
        } else if (member && key.startsWith(`refs/${member.id}/`)) {
          allowed = true;
        } else if (member && key.startsWith(`video-raw/${member.id}/`)) {
          allowed = true;
        } else if (key.startsWith("video-deliveries/")) {
          // video-deliveries/{videoRequestId}/... — same "owner or staff"
          // rule as deliveries/, just against video_requests instead of
          // design_requests (no "latest only" narrowing here: a video
          // request only ever gets one delivered_key, never superseded).
          const videoRequestId = key.split("/")[1] ?? "";
          const row = await db()
            .prepare("SELECT user_id FROM video_requests WHERE id = ?1 AND delivered_key = ?2")
            .bind(videoRequestId, key)
            .first<{ user_id: string }>();
          if (row && member) {
            allowed = row.user_id === member.id;
          }
        } else if (key.startsWith("carousel-deliveries/")) {
          // carousel-deliveries/{carouselRequestId}/{slideIndex}-... — same
          // "owner or staff" rule, against carousel_slides joined to its
          // parent carousel_requests. A slide can be re-delivered (its
          // delivered_key changes when a revision is uploaded), so this
          // only ever matches the current key for that slide, same as the
          // video case.
          const carouselRequestId = key.split("/")[1] ?? "";
          const row = await db()
            .prepare(
              `SELECT c.user_id FROM carousel_slides s
               JOIN carousel_requests c ON c.id = s.carousel_request_id
               WHERE c.id = ?1 AND s.delivered_key = ?2`,
            )
            .bind(carouselRequestId, key)
            .first<{ user_id: string }>();
          if (row && member) {
            allowed = row.user_id === member.id;
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
          let filename = key.split("/").pop() ?? "archivo";
          if (delivery) {
            const ext = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : "png";
            const seq = String(delivery.clientSeq).padStart(2, "0");
            filename = `WITERS_${slugifyFilenamePart(delivery.title)}_${seq}.${ext}`;
          }
          headers["content-disposition"] = `attachment; filename="${filename}"`;
        }

        return new Response(obj.body as unknown as BodyInit, { headers });
      },
    },
  },
});
