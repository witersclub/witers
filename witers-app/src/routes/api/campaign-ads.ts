import { createFileRoute } from "@tanstack/react-router";

import { getCampaignAdDetails } from "../../lib/meta-ads.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

// Per-ad breakdown for one of the member's own campaigns — the drill-down
// behind a campaign card. Takes the LOCAL ad_campaigns.id, never a raw Meta
// campaign id straight from the client, and resolves it to meta_campaign_id
// only after confirming the row belongs to the requesting session user.
export const Route = createFileRoute("/api/campaign-ads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        if (!id) return json({ ok: false, error: "id_requerido" }, { status: 400 });

        const row = await db()
          .prepare(`SELECT meta_campaign_id FROM ad_campaigns WHERE id = ?1 AND user_id = ?2`)
          .bind(id, user.id)
          .first<{ meta_campaign_id: string }>();
        if (!row) return json({ ok: false, error: "no_encontrada" }, { status: 404 });

        const details = await getCampaignAdDetails(row.meta_campaign_id);
        if (!details.ok) return json({ ok: false, error: details.error }, { status: 502 });

        return json({ ok: true, ads: details.data });
      },
    },
  },
});
