import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { requestCompletedEmail, sendMail } from "../../../lib/mail.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

// Staff-only (admin or the designer who claimed it): manually deliver a
// final file for a member request (stored in R2).
export const Route = createFileRoute("/api/admin/deliver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const form = await request.formData();
        const file = form.get("file");
        const requestId = String(form.get("requestId") ?? "");
        const adminNote = String(form.get("adminNote") ?? "").trim();
        if (!(file instanceof File) || !requestId) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        if (!ALLOWED.includes(file.type)) {
          return json({ ok: false, error: "tipo_no_permitido" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return json({ ok: false, error: "muy_grande" }, { status: 400 });
        }

        const reqRow = await db()
          .prepare("SELECT id, claimed_by FROM design_requests WHERE id = ?1")
          .bind(requestId)
          .first<{ id: string; claimed_by: string | null }>();
        if (!reqRow) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (auth.user.role === "designer" && reqRow.claimed_by !== auth.user.id) {
          return json({ ok: false, error: "no_es_tuya" }, { status: 403 });
        }

        const ext =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : file.type === "application/pdf"
                ? "pdf"
                : "jpg";
        const key = `deliveries/${requestId}/${crypto.randomUUID()}.${ext}`;
        await STORAGE.put(key, (await file.arrayBuffer()) as ArrayBuffer, {
          httpMetadata: { contentType: file.type },
        });

        await db()
          .prepare(
            `INSERT INTO request_results (id, request_id, kind, r2_key)
             VALUES (?1, ?2, 'uploaded', ?3)`,
          )
          .bind(crypto.randomUUID(), requestId, key)
          .run();

        await db()
          .prepare(
            `UPDATE design_requests
             SET status = 'completada', admin_note = COALESCE(?2, admin_note),
                 change_request_note = NULL, change_requested_at = NULL, updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(requestId, adminNote || null)
          .run();

        const notifyRow = await db()
          .prepare(
            `SELECT r.title, u.email FROM design_requests r
             JOIN users u ON u.id = r.user_id WHERE r.id = ?1`,
          )
          .bind(requestId)
          .first<{ title: string; email: string }>();
        if (notifyRow) {
          const mail = requestCompletedEmail({
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
