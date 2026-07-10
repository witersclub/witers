import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({ requestId: z.string().uuid() });

// Staff-only: claim an unclaimed request so no two designers work the same
// job. Guarded by "claimed_by IS NULL" so a race between two clicks can
// only let one of them through.
export const Route = createFileRoute("/api/designer/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const result = await db()
          .prepare(
            "UPDATE design_requests SET claimed_by = ?2, claimed_at = datetime('now') WHERE id = ?1 AND claimed_by IS NULL",
          )
          .bind(parsed.data.requestId, auth.user.id)
          .run();

        if (!result.meta.changes) {
          return json({ ok: false, error: "ya_tomada" }, { status: 409 });
        }

        return json({ ok: true });
      },
    },
  },
});
