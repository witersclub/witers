import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  userId: z.string().uuid(),
  metaCampaignId: z.string().min(1),
});

// Adds one real Meta campaign (already picked from /api/admin/meta-campaigns'
// live list) to a client's dashboard — request_id/adset/objective/budget
// are left null since none of that is known locally for a campaign staff
// created directly in Ads Manager; the panel reads all of it live from Meta
// instead (see getCampaignInsight). A campaign can be added to any number of
// clients' panels — several accounts sharing one ad account (team members,
// staff test accounts) is normal, not the exception; the only thing staff
// can't do is add the same campaign to the same client twice.
export const Route = createFileRoute("/api/admin/link-campaign")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const existing = await db()
          .prepare("SELECT id FROM ad_campaigns WHERE meta_campaign_id = ?1 AND user_id = ?2")
          .bind(parsed.data.metaCampaignId, parsed.data.userId)
          .first<{ id: string }>();
        if (existing) return json({ ok: false, error: "ya_vinculada" }, { status: 409 });

        await db()
          .prepare(
            `INSERT INTO ad_campaigns (id, user_id, meta_campaign_id, status, linked_by)
             VALUES (?1, ?2, ?3, 'linked', ?4)`,
          )
          .bind(crypto.randomUUID(), parsed.data.userId, parsed.data.metaCampaignId, auth.user.id)
          .run();

        return json({ ok: true });
      },
    },
  },
});
