import { createFileRoute } from "@tanstack/react-router";

import { getBrandProfile } from "../../../lib/brand-profile.server";
import { listAdAccountCampaigns } from "../../../lib/meta-ads.server";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Every campaign that exists right now in a client's own Meta ad account —
// staff picks which of these actually show up in that client's dashboard
// (see /api/admin/link-campaign). Deliberately NOT client-facing: showing a
// client their whole ad account would surface drafts, tests, and anything
// else staff isn't ready for them to see (see the "no quiero que se vean
// tooodas las campañas" conversation this replaced the old wizard for).
export const Route = createFileRoute("/api/admin/meta-campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const userId = new URL(request.url).searchParams.get("userId");
        if (!userId) return json({ ok: false, error: "falta_userId" }, { status: 400 });

        const brandProfile = await getBrandProfile(userId);
        if (!brandProfile?.meta_ad_account_id) {
          return json({ ok: false, error: "cuenta_no_conectada" }, { status: 409 });
        }

        const result = await listAdAccountCampaigns(brandProfile.meta_ad_account_id);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });

        const linkedRows = await db()
          .prepare("SELECT meta_campaign_id FROM ad_campaigns WHERE user_id = ?1")
          .bind(userId)
          .all<{ meta_campaign_id: string }>();
        const linkedIds = new Set((linkedRows.results ?? []).map((r) => r.meta_campaign_id));

        return json({
          ok: true,
          campaigns: result.data.map((c) => ({ ...c, linked: linkedIds.has(c.id) })),
        });
      },
    },
  },
});
