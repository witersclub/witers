import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  message: z.string().min(5).max(1000),
});

// Client-only: ask for a revision on a delivered piece. Free (does not
// touch the membership quota) — capped at 2 per request. Flips status back
// to 'en_proceso' so the design team sees it needs attention again.
export const Route = createFileRoute("/api/request-revision")({
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
          .prepare("SELECT status, revisions_used FROM design_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.requestId, user.id)
          .first<{ status: string; revisions_used: number }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (row.status !== "completada") {
          return json({ ok: false, error: "no_completada" }, { status: 409 });
        }
        if (row.revisions_used >= 2) {
          return json({ ok: false, error: "sin_cambios_disponibles" }, { status: 409 });
        }

        const noteColumn = row.revisions_used === 0 ? "revision_note_1" : "revision_note_2";
        await db()
          .prepare(
            `UPDATE design_requests
             SET status = 'en_proceso', revisions_used = revisions_used + 1,
                 ${noteColumn} = ?2, updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(parsed.data.requestId, parsed.data.message.trim())
          .run();

        return json({ ok: true });
      },
    },
  },
});
