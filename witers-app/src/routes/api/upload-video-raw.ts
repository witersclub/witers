import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../lib/bindings.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

// Raw client footage can run much larger than a reference image/PDF —
// buffering it into the Worker's isolate memory the way upload-reference.ts
// and deliver.ts do (file.arrayBuffer() before STORAGE.put()) would risk
// hitting the isolate's memory ceiling. So this endpoint takes the file as
// the raw request body (not multipart) and pipes request.body — already a
// ReadableStream — straight into R2 without ever holding the whole file in
// memory at once.
const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

export const Route = createFileRoute("/api/upload-video-raw")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const url = new URL(request.url);
        const originalName = (url.searchParams.get("filename") ?? "video").slice(0, 200);
        const contentType = request.headers.get("content-type") ?? "";
        if (!ALLOWED.includes(contentType)) {
          return json({ ok: false, error: "tipo_no_permitido" }, { status: 400 });
        }

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > MAX_BYTES) {
          return json({ ok: false, error: "muy_grande" }, { status: 400 });
        }
        if (!request.body) {
          return json({ ok: false, error: "archivo_faltante" }, { status: 400 });
        }

        const ext = EXT_BY_TYPE[contentType] ?? "mp4";
        const key = `video-raw/${user.id}/${crypto.randomUUID()}.${ext}`;
        // request.body is a real ReadableStream at runtime — cast past the
        // mismatch between DOM's global ReadableStream (lib.dom) and the
        // one @cloudflare/workers-types declares for R2Bucket.put's
        // signature; R2 accepts it either way.
        await STORAGE.put(key, request.body as unknown as ArrayBuffer, {
          httpMetadata: { contentType },
        });

        await db()
          .prepare(
            `INSERT INTO video_request_raw_files (id, video_request_id, r2_key, original_name, size_bytes)
             VALUES (?1, NULL, ?2, ?3, ?4)`,
          )
          .bind(crypto.randomUUID(), key, originalName, contentLength)
          .run();

        return json({ ok: true, key });
      },
    },
  },
});
