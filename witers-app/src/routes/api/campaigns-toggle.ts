import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getMetaAdOAuthAccessToken } from "../../lib/meta-ad-account-connection.server";
import { setCampaignStatus } from "../../lib/meta-ads.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

type CampaignRow = { meta_campaign_id: string };

// The switch on each Campañas-tab card — flips a campaign that already
// exists between ACTIVE and PAUSED. `id` is WITERS's own local row id, never
// Meta's campaign id directly: it's looked up here scoped to the session's
// own user_id, so one client can never toggle another's campaign by guessing
// or replaying an id (same multi-tenant rule as every other Meta write in
// this app).
export const Route = createFileRoute("/api/campaigns-toggle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const row = await db()
          .prepare(`SELECT meta_campaign_id FROM ad_campaigns WHERE id = ?1 AND user_id = ?2`)
          .bind(parsed.data.id, user.id)
          .first<CampaignRow>();
        if (!row || !row.meta_campaign_id) {
          return json({ ok: false, error: "campana_no_existe" }, { status: 404 });
        }

        const oauthAccessToken = await getMetaAdOAuthAccessToken(user.id);
        const result = await setCampaignStatus(
          row.meta_campaign_id,
          parsed.data.active,
          oauthAccessToken,
        );
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });

        await db()
          .prepare(
            "UPDATE ad_campaigns SET status = ?2, updated_at = datetime('now') WHERE id = ?1",
          )
          .bind(parsed.data.id, parsed.data.active ? "active" : "paused")
          .run();

        return json({ ok: true });
      },
    },
  },
});
