import { createFileRoute } from "@tanstack/react-router";

import { db, getSessionUser, json } from "../../../../lib/witers-auth.server";

type PendingPage = { id: string; name: string; instagramUserId: string | null };
type PendingRow = { pages_json: string };

// Backs the "which Page?" picker the client sees after connecting when
// they manage more than one Facebook Page — returns just id/name/whether
// Instagram is linked, never the (encrypted) tokens riding along in
// pages_json.
export const Route = createFileRoute("/api/social/connect/pending")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!id) return json({ ok: false, error: "falta_id" }, { status: 400 });

        const row = await db()
          .prepare(
            `SELECT pages_json FROM social_connect_pending
             WHERE id = ?1 AND user_id = ?2 AND used_at IS NULL AND expires_at > datetime('now')`,
          )
          .bind(id, user.id)
          .first<PendingRow>();
        if (!row) return json({ ok: false, error: "no_encontrado_o_vencido" }, { status: 404 });

        const pages = (JSON.parse(row.pages_json) as (PendingPage & Record<string, unknown>)[]).map(
          (p) => ({ id: p.id, name: p.name, instagramUserId: p.instagramUserId }),
        );
        return json({ ok: true, pages });
      },
    },
  },
});
