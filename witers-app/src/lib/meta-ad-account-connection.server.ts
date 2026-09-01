import { decryptToken } from "./token-crypto.server";
import { db } from "./witers-auth.server";

type ConnectionRow = { ad_account_id: string; access_token: string; token_iv: string };

export async function getMetaAdOAuthAccessToken(
  userId: string,
  expectedAccountId?: string | null,
): Promise<string | null> {
  const row = await db()
    .prepare(
      `SELECT ad_account_id, access_token, token_iv
       FROM meta_ad_account_connections WHERE user_id = ?1 LIMIT 1`,
    )
    .bind(userId)
    .first<ConnectionRow>();
  if (!row || (expectedAccountId && row.ad_account_id !== expectedAccountId)) return null;
  try {
    return await decryptToken(row.access_token, row.token_iv);
  } catch {
    return null;
  }
}
