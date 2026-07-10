import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ requestId: z.string().uuid() });

// Client-only: confirm a delivered piece is correct and close the request
// for good. Once closed, staff can no longer edit or re-deliver it.
export const Route = createFileRoute("/api/close-request")({
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
          .prepare("SELECT status FROM design_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.requestId, user.id)
          .first<{ status: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (row.status !== "completada") {
          return json({ ok: false, error: "no_completada" }, { status: 409 });
        }

        await db()
          .prepare(
            "UPDATE design_requests SET status = 'cerrada', updated_at = datetime('now') WHERE id = ?1",
          )
          .bind(parsed.data.requestId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
