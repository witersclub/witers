import { createFileRoute } from "@tanstack/react-router";

import { db, getSessionUser, json } from "../../../../lib/witers-auth.server";

export const Route = createFileRoute("/api/meta/ad-account/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const row = await db()
          .prepare(
            `SELECT c.ad_account_id, c.account_name
             FROM meta_ad_account_connections c WHERE c.user_id = ?1 LIMIT 1`,
          )
          .bind(user.id)
          .first<{ ad_account_id: string; account_name: string | null }>();
        if (row) {
          return json({
            ok: true,
            connected: true,
            accountId: row.ad_account_id,
            accountName: row.account_name,
          });
        }
        const profile = await db()
          .prepare("SELECT meta_ad_account_id FROM brand_profiles WHERE user_id = ?1")
          .bind(user.id)
          .first<{ meta_ad_account_id: string | null }>();
        return json({
          ok: true,
          connected: Boolean(profile?.meta_ad_account_id),
          accountId: profile?.meta_ad_account_id ?? null,
          accountName: null,
        });
      },
    },
  },
});
