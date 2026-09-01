import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db, getSessionUser, json } from "../../../../lib/witers-auth.server";
const schema = z.object({ pendingId: z.string().uuid(), accountId: z.string().min(1) });
export const Route = createFileRoute("/api/meta/ad-account/finalize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const row = await db()
          .prepare(
            `SELECT accounts_json, access_token, token_iv
             FROM meta_ad_account_connect_pending
             WHERE id=?1 AND user_id=?2 AND used_at IS NULL AND expires_at>datetime('now')`,
          )
          .bind(parsed.data.pendingId, user.id)
          .first<{ accounts_json: string; access_token: string; token_iv: string }>();
        const accounts = row
          ? (JSON.parse(row.accounts_json) as Array<{ account_id: string; name?: string }>)
          : [];
        if (!accounts.some((a) => a.account_id === parsed.data.accountId))
          return json({ ok: false, error: "cuenta_invalida" }, { status: 404 });
        const chosen = accounts.find((account) => account.account_id === parsed.data.accountId)!;
        await db()
          .prepare(
            "UPDATE brand_profiles SET meta_ad_account_id=?2,updated_at=datetime('now') WHERE user_id=?1",
          )
          .bind(user.id, parsed.data.accountId)
          .run();
        await db()
          .prepare(
            `INSERT INTO meta_ad_account_connections
               (user_id, ad_account_id, access_token, token_iv, account_name)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(user_id) DO UPDATE SET
               ad_account_id=excluded.ad_account_id,
               access_token=excluded.access_token,
               token_iv=excluded.token_iv,
               account_name=excluded.account_name,
               updated_at=datetime('now')`,
          )
          .bind(
            user.id,
            parsed.data.accountId,
            row!.access_token,
            row!.token_iv,
            chosen.name ?? null,
          )
          .run();
        await db()
          .prepare("UPDATE meta_ad_account_connect_pending SET used_at=datetime('now') WHERE id=?1")
          .bind(parsed.data.pendingId)
          .run();
        return json({ ok: true });
      },
    },
  },
});
