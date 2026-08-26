import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({ requestId: z.string().uuid() });

// Staff-only: undo a claim so the request becomes available for anyone
// again — for when a designer took a job they can't actually finish.
// Unlike video/carousel, design_requests has no separate "nueva" status
// (it defaults to "en_proceso" at creation, see migration 0002); a
// design_request is "available" purely by claimed_by being NULL, so
// releasing only ever needs to clear the claim, never touch status. Guarded
// by claimed_by = the caller AND status = 'en_proceso' so a delivered,
// rejected, or closed request can never be reopened through this path.
export const Route = createFileRoute("/api/designer/release")({
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
            `UPDATE design_requests SET claimed_by = NULL, claimed_at = NULL
             WHERE id = ?1 AND claimed_by = ?2 AND status = 'en_proceso'`,
          )
          .bind(parsed.data.requestId, auth.user.id)
          .run();

        if (!result.meta.changes) {
          return json({ ok: false, error: "no_se_pudo_soltar" }, { status: 409 });
        }

        return json({ ok: true });
      },
    },
  },
});
