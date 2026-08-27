import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { recordBrandSignal } from "../../lib/brand-memory.server";
import { notifyStaffVideoChangeRequested } from "../../lib/mail.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  videoRequestId: z.string().uuid(),
  message: z.string().min(5).max(1000),
});

// Client-only: mirrors /api/carousel-request-change — video_requests never
// had a "pedir cambio" flow on a delivered piece, so a corte final just sat
// there with no way to ask for an adjustment. No admin approval gate (same
// as carousel): the note reopens the request straight to 'en_proceso' so it
// reappears in the designer's active queue (mine && status !== 'completada'
// in staff-video-requests.tsx already re-shows the upload form for it).
export const Route = createFileRoute("/api/video-request-change")({
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
          .prepare("SELECT title, status FROM video_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.videoRequestId, user.id)
          .first<{ title: string; status: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (row.status !== "completada") {
          return json({ ok: false, error: "no_completada" }, { status: 409 });
        }

        const message = parsed.data.message.trim();

        await db()
          .prepare(
            `UPDATE video_requests
             SET status = 'en_proceso', change_request_note = ?2,
                 change_requested_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(parsed.data.videoRequestId, message)
          .run();

        await notifyStaffVideoChangeRequested({
          title: row.title,
          clientName: user.name,
          message,
          panelUrl: "https://witers.com/witer",
        });

        await recordBrandSignal(
          user.id,
          `El cliente solicitó un cambio en el video "${row.title}" ya entregado. Motivo: ${message}.`,
        );

        return json({ ok: true });
      },
    },
  },
});
