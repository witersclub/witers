import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({ videoRequestId: z.string().uuid() });

// Staff-only: claim an unclaimed video request — same atomic pattern as
// /api/designer/claim.ts for design_requests.
export const Route = createFileRoute("/api/designer/claim-video")({
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
            "UPDATE video_requests SET claimed_by = ?2, claimed_at = datetime('now'), status = 'en_proceso' WHERE id = ?1 AND claimed_by IS NULL",
          )
          .bind(parsed.data.videoRequestId, auth.user.id)
          .run();

        if (!result.meta.changes) {
          return json({ ok: false, error: "ya_tomada" }, { status: 409 });
        }

        return json({ ok: true });
      },
    },
  },
});
