import { createFileRoute } from "@tanstack/react-router";

import { bindings } from "../../../lib/bindings.server";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

// Admin-only: manually deliver a final file for a member request (stored in R2).
export const Route = createFileRoute("/api/admin/deliver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_admin" }, { status: auth.status });

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const form = await request.formData();
        const file = form.get("file");
        const requestId = String(form.get("requestId") ?? "");
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
          .prepare("SELECT id FROM design_requests WHERE id = ?1")
          .bind(requestId)
          .first();
        if (!reqRow) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });

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
            "UPDATE design_requests SET status = 'completada', updated_at = datetime('now') WHERE id = ?1",
          )
          .bind(requestId)
          .run();

        return json({ ok: true, key });
      },
    },
  },
});

