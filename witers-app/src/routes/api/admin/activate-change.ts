import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({ requestId: z.string().uuid() });

// Admin-only: approve a client's post-close error report and reopen the
// piece for the design team. Flips status to 'en_proceso' so it reappears
// immediately in the designer panel — matches the same status the free
// pre-close revision flow (/api/request-revision) uses.
export const Route = createFileRoute("/api/admin/activate-change")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare("SELECT status FROM design_requests WHERE id = ?1")
          .bind(parsed.data.requestId)
          .first<{ status: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });
        if (row.status !== "cambio_solicitado") {
          return json({ ok: false, error: "no_pendiente" }, { status: 409 });
        }

        await db()
          .prepare(
            `UPDATE design_requests SET status = 'en_proceso', updated_at = datetime('now') WHERE id = ?1`,
          )
          .bind(parsed.data.requestId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
