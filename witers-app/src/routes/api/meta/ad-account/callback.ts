import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeMetaAdAccountCode,
  listAccessibleAdAccounts,
} from "../../../../lib/meta-ad-account-auth.server";
import { encryptToken } from "../../../../lib/token-crypto.server";
import { db, getSessionUser } from "../../../../lib/witers-auth.server";

const clear =
  "wit_meta_ads_state=; Path=/api/meta/ad-account; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location, "set-cookie": clear } });
}
function cookie(request: Request, name: string) {
  return (
    request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? null
  );
}

export const Route = createFileRoute("/api/meta/ad-account/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return redirect("/ingresar");
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state || state !== cookie(request, "wit_meta_ads_state"))
          return redirect("/panel?meta_ads_error=estado");
        const token = await exchangeMetaAdAccountCode(code, url.origin);
        if (!token.ok) return redirect("/panel?meta_ads_error=oauth");
        const listed = await listAccessibleAdAccounts(token.token);
        if (!listed.ok || !listed.accounts.length)
          return redirect("/panel?meta_ads_error=sin_cuentas");
        const encrypted = await encryptToken(token.token);
        if (listed.accounts.length === 1) {
          const accountId = listed.accounts[0].account_id;
          await db()
            .prepare(
              "UPDATE brand_profiles SET meta_ad_account_id = ?2, updated_at = datetime('now') WHERE user_id = ?1",
            )
            .bind(user.id, accountId)
            .run();
          await db()
            .prepare(
              `INSERT INTO meta_ad_account_connections
                 (user_id, ad_account_id, access_token, token_iv)
               VALUES (?1, ?2, ?3, ?4)
               ON CONFLICT(user_id) DO UPDATE SET
                 ad_account_id=excluded.ad_account_id,
                 access_token=excluded.access_token,
                 token_iv=excluded.token_iv,
                 updated_at=datetime('now')`,
            )
            .bind(user.id, accountId, encrypted.ciphertext, encrypted.iv)
            .run();
          return redirect("/panel?meta_ads_connected=1");
        }
        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO meta_ad_account_connect_pending
               (id,user_id,accounts_json,access_token,token_iv,expires_at)
             VALUES (?1,?2,?3,?4,?5,datetime('now','+10 minutes'))`,
          )
          .bind(id, user.id, JSON.stringify(listed.accounts), encrypted.ciphertext, encrypted.iv)
          .run();
        return redirect(`/panel?meta_ads_pick=${id}`);
      },
    },
  },
});
