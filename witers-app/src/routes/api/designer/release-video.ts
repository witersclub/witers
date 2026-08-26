import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({ videoRequestId: z.string().uuid() });

// Staff-only: undo a claim on a video request. Unlike design_requests,
// video_requests starts life at status 'nueva' and claim-video.ts flips it
// to 'en_proceso' — releasing puts that back to 'nueva' so it visibly
// returns to the unclaimed queue, not just an unclaimed 'en_proceso' row.
export const Route = createFileRoute("/api/designer/release-video")({
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
            `UPDATE video_requests SET claimed_by = NULL, claimed_at = NULL, status = 'nueva'
             WHERE id = ?1 AND claimed_by = ?2 AND status = 'en_proceso'`,
          )
          .bind(parsed.data.videoRequestId, auth.user.id)
          .run();

        if (!result.meta.changes) {
          return json({ ok: false, error: "no_se_pudo_soltar" }, { status: 409 });
        }

        return json({ ok: true });
      },
    },
  },
});
