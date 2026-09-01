import { createFileRoute } from "@tanstack/react-router";
import { db, getSessionUser, json } from "../../../../lib/witers-auth.server";
export const Route = createFileRoute("/api/meta/ad-account/pending")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const id = new URL(request.url).searchParams.get("id");
        const row = id
          ? await db()
              .prepare(
                `SELECT accounts_json FROM meta_ad_account_connect_pending WHERE id=?1 AND user_id=?2 AND used_at IS NULL AND expires_at>datetime('now')`,
              )
              .bind(id, user.id)
              .first<{ accounts_json: string }>()
          : null;
        return row
          ? json({ ok: true, accounts: JSON.parse(row.accounts_json) })
          : json({ ok: false, error: "no_encontrado" }, { status: 404 });
      },
    },
  },
});
