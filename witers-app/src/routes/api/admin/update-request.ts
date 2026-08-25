import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { recordBrandSignal } from "../../../lib/brand-memory.server";
import { requestCompletedEmail, sendMail } from "../../../lib/mail.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["en_proceso", "completada", "rechazada"]),
  adminNote: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/admin/update-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        if (auth.user.role === "designer") {
          const reqRow = await db()
            .prepare("SELECT claimed_by FROM design_requests WHERE id = ?1")
            .bind(parsed.data.requestId)
            .first<{ claimed_by: string | null }>();
          if (!reqRow || reqRow.claimed_by !== auth.user.id) {
            return json({ ok: false, error: "no_es_tuya" }, { status: 403 });
          }
        }

        await db()
          .prepare(
            `UPDATE design_requests
             SET status = ?2, admin_note = COALESCE(?3, admin_note), updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(parsed.data.requestId, parsed.data.status, parsed.data.adminNote ?? null)
          .run();

        if (parsed.data.status === "completada") {
          const notifyRow = await db()
            .prepare(
              `SELECT r.title, u.email FROM design_requests r
               JOIN users u ON u.id = r.user_id WHERE r.id = ?1`,
            )
            .bind(parsed.data.requestId)
            .first<{ title: string; email: string }>();
          if (notifyRow) {
            const mail = requestCompletedEmail({
              title: notifyRow.title,
              requestUrl: "https://witers.com/panel",
            });
            await sendMail({ to: notifyRow.email, ...mail });
          }
        }

        if (parsed.data.status === "rechazada") {
          const rejectedRow = await db()
            .prepare("SELECT title, user_id FROM design_requests WHERE id = ?1")
            .bind(parsed.data.requestId)
            .first<{ title: string; user_id: string }>();
          if (rejectedRow) {
            await recordBrandSignal(
              rejectedRow.user_id,
              `Solicitud de diseño "${rejectedRow.title}" fue rechazada por el equipo. Motivo: ${
                parsed.data.adminNote?.trim() || "sin motivo especificado"
              }.`,
            );
          }
        }

        return json({ ok: true });
      },
    },
  },
});
