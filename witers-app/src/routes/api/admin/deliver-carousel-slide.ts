import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { carouselRequestCompletedEmail, sendMail } from "../../../lib/mail.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Same streamed-body approach as upload-video-raw.ts / deliver-video.ts.
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Uploads (or replaces) a single lámina of a carousel. Re-uploading a
// lámina that already had a change_request_note clears it — the client
// asking for a fix on one slide and the designer re-delivering just that
// slide is the whole revision loop, no separate "activate" step (unlike
// the post-close change flow for plain image requests): carousels stay
// open to per-slide re-delivery for as long as the request exists.
export const Route = createFileRoute("/api/admin/deliver-carousel-slide")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const url = new URL(request.url);
        const carouselRequestId = url.searchParams.get("carouselRequestId") ?? "";
        const slideIndex = Number(url.searchParams.get("slideIndex") ?? 0);
        const contentType = request.headers.get("content-type") ?? "";
        if (
          !carouselRequestId ||
          !Number.isInteger(slideIndex) ||
          slideIndex < 1 ||
          slideIndex > 4 ||
          !ALLOWED.includes(contentType)
        ) {
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
          .prepare("SELECT id, claimed_by, title FROM carousel_requests WHERE id = ?1")
          .bind(carouselRequestId)
          .first<{ id: string; claimed_by: string | null; title: string }>();
        if (!reqRow) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (auth.user.role === "designer" && reqRow.claimed_by !== auth.user.id) {
          return json({ ok: false, error: "no_es_tuya" }, { status: 403 });
        }

        const ext = EXT_BY_TYPE[contentType] ?? "png";
        const key = `carousel-deliveries/${carouselRequestId}/${slideIndex}-${crypto.randomUUID()}.${ext}`;
        await STORAGE.put(key, request.body as unknown as ArrayBuffer, {
          httpMetadata: { contentType },
        });

        const result = await db()
          .prepare(
            `UPDATE carousel_slides
             SET delivered_key = ?3, delivered_at = datetime('now'),
                 change_request_note = NULL, change_requested_at = NULL
             WHERE carousel_request_id = ?1 AND slide_index = ?2`,
          )
          .bind(carouselRequestId, slideIndex, key)
          .run();
        if (!result.meta.changes) {
          return json({ ok: false, error: "lamina_no_existe" }, { status: 404 });
        }

        const remaining = await db()
          .prepare(
            "SELECT COUNT(*) AS n FROM carousel_slides WHERE carousel_request_id = ?1 AND delivered_key IS NULL",
          )
          .bind(carouselRequestId)
          .first<{ n: number }>();

        if ((remaining?.n ?? 1) === 0) {
          const flipped = await db()
            .prepare(
              `UPDATE carousel_requests SET status = 'completada', updated_at = datetime('now')
               WHERE id = ?1 AND status != 'completada'`,
            )
            .bind(carouselRequestId)
            .run();
          if (flipped.meta.changes) {
            const notifyRow = await db()
              .prepare(
                "SELECT u.email FROM carousel_requests c JOIN users u ON u.id = c.user_id WHERE c.id = ?1",
              )
              .bind(carouselRequestId)
              .first<{ email: string }>();
            if (notifyRow) {
              const mail = carouselRequestCompletedEmail({
                title: reqRow.title,
                requestUrl: "https://witers.com/panel",
              });
              await sendMail({ to: notifyRow.email, ...mail });
            }
          }
        }

        return json({ ok: true, key });
      },
    },
  },
});
