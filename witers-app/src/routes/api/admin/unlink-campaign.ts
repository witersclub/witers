import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  userId: z.string().uuid(),
  metaCampaignId: z.string().min(1),
});

// Removes a campaign from a client's dashboard — the campaign itself is
// untouched in Meta (nothing gets paused/deleted there), this only hides it
// from that client's panel. Scoped to userId too, not just metaCampaignId,
// so an admin can't accidentally unlink a campaign that belongs to a
// different client than the one they're looking at.
export const Route = createFileRoute("/api/admin/unlink-campaign")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        await db()
          .prepare("DELETE FROM ad_campaigns WHERE user_id = ?1 AND meta_campaign_id = ?2")
          .bind(parsed.data.userId, parsed.data.metaCampaignId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
