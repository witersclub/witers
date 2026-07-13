import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
});

// Staff-only (admin or designer): approve AI-generated drafts (kind='draft')
// for a request so they become visible to the client and mark the request
// completed.
export const Route = createFileRoute("/api/admin/approve-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_autorizado" }, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const result = await db()
          .prepare(
            "UPDATE request_results SET kind = 'generated' WHERE request_id = ?1 AND kind = 'draft'",
          )
          .bind(parsed.data.requestId)
          .run();

        if (!result.meta.changes) {
          return json({ ok: false, error: "sin_borradores" }, { status: 404 });
        }

        await db()
          .prepare(
            "UPDATE design_requests SET status = 'completada', updated_at = datetime('now') WHERE id = ?1",
          )
          .bind(parsed.data.requestId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
