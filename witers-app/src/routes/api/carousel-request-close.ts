import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ carouselRequestId: z.string().uuid() });

// Client-only: same "aceptar y finalizar" close that design_requests
// already has (see /api/close-request) — carousel requests never had it,
// so a "Listo" carousel stayed there forever with no explicit acceptance.
export const Route = createFileRoute("/api/carousel-request-close")({
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
          .prepare("SELECT status FROM carousel_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.carouselRequestId, user.id)
          .first<{ status: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (row.status !== "completada") {
          return json({ ok: false, error: "no_completada" }, { status: 409 });
        }

        await db()
          .prepare(
            "UPDATE carousel_requests SET status = 'cerrada', updated_at = datetime('now') WHERE id = ?1",
          )
          .bind(parsed.data.carouselRequestId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
