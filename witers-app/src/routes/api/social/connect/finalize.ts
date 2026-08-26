import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { upsertSocialConnection } from "../../../../lib/social-connections.server";
import { db, getSessionUser, json } from "../../../../lib/witers-auth.server";

type PendingPage = {
  id: string;
  name: string;
  ciphertext: string;
  iv: string;
  instagramUserId: string | null;
};
type PendingRow = { pages_json: string };

const schema = z.object({ pendingId: z.string().uuid(), pageId: z.string() });

// Second half of the multi-Page connect flow: the client picked one Page
// from the list pending.ts returned, this writes the real
// social_connections rows from that Page's already-encrypted token (no
// need to decrypt/re-encrypt — the ciphertext+iv just move over as-is) and
// marks the pending row used so it can't be replayed.
export const Route = createFileRoute("/api/social/connect/finalize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const row = await db()
          .prepare(
            `SELECT pages_json FROM social_connect_pending
             WHERE id = ?1 AND user_id = ?2 AND used_at IS NULL AND expires_at > datetime('now')`,
          )
          .bind(parsed.data.pendingId, user.id)
          .first<PendingRow>();
        if (!row) return json({ ok: false, error: "no_encontrado_o_vencido" }, { status: 404 });

        const pages = JSON.parse(row.pages_json) as PendingPage[];
        const page = pages.find((p) => p.id === parsed.data.pageId);
        if (!page) return json({ ok: false, error: "pagina_invalida" }, { status: 400 });

        await upsertSocialConnection(
          user.id,
          "facebook",
          page.id,
          page.name,
          page.id,
          page.ciphertext,
          page.iv,
        );
        if (page.instagramUserId) {
          await upsertSocialConnection(
            user.id,
            "instagram",
            page.instagramUserId,
            page.name,
            page.id,
            page.ciphertext,
            page.iv,
          );
        }

        await db()
          .prepare("UPDATE social_connect_pending SET used_at = datetime('now') WHERE id = ?1")
          .bind(parsed.data.pendingId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
