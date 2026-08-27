// Shared write path for social_connections rows — used by the OAuth
// callback (single-Page case), the multi-Page finalize step, and nowhere
// else, so the upsert SQL lives in one place instead of being duplicated
// between those two routes.
import { db } from "./witers-auth.server";

export async function upsertSocialConnection(
  userId: string,
  platform: "facebook" | "instagram",
  externalId: string,
  externalName: string,
  pageId: string | null,
  ciphertext: string,
  iv: string,
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO social_connections (id, user_id, platform, external_id, external_name, page_id, access_token, token_iv)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(user_id, platform) DO UPDATE SET
         external_id = excluded.external_id, external_name = excluded.external_name,
         page_id = excluded.page_id, access_token = excluded.access_token,
         token_iv = excluded.token_iv, updated_at = datetime('now')`,
    )
    .bind(crypto.randomUUID(), userId, platform, externalId, externalName, pageId, ciphertext, iv)
    .run();
}
