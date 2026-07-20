import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { videoRequestCompletedEmail, sendMail } from "../../../lib/mail.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Same streamed-body approach as upload-video-raw.ts — the edited final cut
// can be just as large as the raw footage, so this never buffers it fully
// into memory either.
const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

export const Route = createFileRoute("/api/admin/deliver-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const url = new URL(request.url);
        const videoRequestId = url.searchParams.get("videoRequestId") ?? "";
        const adminNote = (url.searchParams.get("adminNote") ?? "").trim().slice(0, 2000);
        const contentType = request.headers.get("content-type") ?? "";
        if (!videoRequestId || !ALLOWED.includes(contentType)) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > MAX_BYTES) {
          return json({ ok: false, error: "muy_grande" }, { status: 400 });
        }
        if (!request.body) {
          return json({ ok: false, error: "archivo_faltante" }, { status: 400 });
        }

        const reqRow = await db()
          .prepare("SELECT id, claimed_by FROM video_requests WHERE id = ?1")
          .bind(videoRequestId)
          .first<{ id: string; claimed_by: string | null }>();
        if (!reqRow) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (auth.user.role === "designer" && reqRow.claimed_by !== auth.user.id) {
          return json({ ok: false, error: "no_es_tuya" }, { status: 403 });
        }

        const ext = EXT_BY_TYPE[contentType] ?? "mp4";
        const key = `video-deliveries/${videoRequestId}/${crypto.randomUUID()}.${ext}`;
        // See upload-video-raw.ts — same DOM-vs-workers-types ReadableStream
        // mismatch, harmless cast, R2 accepts a real stream either way.
        await STORAGE.put(key, request.body as unknown as ArrayBuffer, {
          httpMetadata: { contentType },
        });

        await db()
          .prepare(
            `UPDATE video_requests
             SET status = 'completada', delivered_key = ?2, delivered_at = datetime('now'),
                 admin_note = COALESCE(?3, admin_note), updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(videoRequestId, key, adminNote || null)
          .run();

        const notifyRow = await db()
          .prepare(
            `SELECT v.title, u.email FROM video_requests v
             JOIN users u ON u.id = v.user_id WHERE v.id = ?1`,
          )
          .bind(videoRequestId)
          .first<{ title: string; email: string }>();
        if (notifyRow) {
          const mail = videoRequestCompletedEmail({
            title: notifyRow.title,
            requestUrl: "https://witers.com/panel",
          });
          await sendMail({ to: notifyRow.email, ...mail });
        }

        return json({ ok: true, key });
      },
    },
  },
});
