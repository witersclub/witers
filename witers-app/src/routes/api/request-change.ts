import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { recordBrandSignal } from "../../lib/brand-memory.server";
import { notifyStaffChangeRequested } from "../../lib/mail.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  message: z.string().min(5).max(1000),
});

// Client-only: report an error on a piece already marked "cerrada"
// (finalized). Unlike /api/request-revision, this doesn't reopen the
// request directly — it waits in "cambio_solicitado" for an admin to
// review and activate it (see /api/admin/activate-change).
export const Route = createFileRoute("/api/request-change")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare("SELECT title, status FROM design_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.requestId, user.id)
          .first<{ title: string; status: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (row.status !== "cerrada") {
          return json({ ok: false, error: "no_cerrada" }, { status: 409 });
        }

        await db()
          .prepare(
            `UPDATE design_requests
             SET status = 'cambio_solicitado', change_request_note = ?2,
                 change_requested_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(parsed.data.requestId, parsed.data.message.trim())
          .run();

        await notifyStaffChangeRequested({
          title: row.title,
          clientName: user.name,
          message: parsed.data.message.trim(),
          panelUrl: "https://witers.com/admin",
        });

        await recordBrandSignal(
          user.id,
          `El cliente solicitó un cambio en la pieza "${row.title}" ya entregada. Motivo: ${parsed.data.message.trim()}.`,
        );

        return json({ ok: true });
      },
    },
  },
});
