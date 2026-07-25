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
// instead (see getCampaignInsight).
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

        const targetUser = await db()
          .prepare("SELECT role FROM users WHERE id = ?1")
          .bind(parsed.data.userId)
          .first<{ role: string }>();
        if (!targetUser)
          return json({ ok: false, error: "usuario_no_encontrado" }, { status: 404 });

        // Admins can preview a real client's campaign in their own panel —
        // test accounts often share a client's ad account — without taking
        // it away from that client: only real (non-preview) links compete
        // for the one-client-per-campaign rule (see idx_ad_campaigns_meta_campaign).
        const staffPreview = targetUser.role === "admin";
        if (!staffPreview) {
          const existing = await db()
            .prepare(
              "SELECT id FROM ad_campaigns WHERE meta_campaign_id = ?1 AND staff_preview = 0",
            )
            .bind(parsed.data.metaCampaignId)
            .first<{ id: string }>();
          if (existing) return json({ ok: false, error: "ya_vinculada" }, { status: 409 });
        }

        await db()
          .prepare(
            `INSERT INTO ad_campaigns (id, user_id, meta_campaign_id, status, linked_by, staff_preview)
             VALUES (?1, ?2, ?3, 'linked', ?4, ?5)`,
          )
          .bind(
            crypto.randomUUID(),
            parsed.data.userId,
            parsed.data.metaCampaignId,
            auth.user.id,
            staffPreview ? 1 : 0,
          )
          .run();

        return json({ ok: true });
      },
    },
  },
});
