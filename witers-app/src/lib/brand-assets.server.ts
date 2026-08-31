import { db } from "./witers-auth.server";

export type BrandAsset = {
  id: string;
  user_id: string;
  r2_key: string;
  original_name: string;
  kind: "manual" | "strategy" | "reference" | "product" | "video";
  mime_type: string;
  size_bytes: number;
  use_in_planning: number;
  text_content: string | null;
  created_at: string;
};

export async function getBrandAssets(userId: string): Promise<BrandAsset[]> {
  const rows = await db()
    .prepare(
      `SELECT id, user_id, r2_key, original_name, kind, mime_type, size_bytes,
              use_in_planning, text_content, created_at
       FROM brand_assets WHERE user_id = ?1 ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<BrandAsset>();
  return rows.results ?? [];
}

export async function getPlanningBrandAssets(userId: string, requestedIds?: string[]) {
  const assets = await getBrandAssets(userId);
  const requested = requestedIds?.length ? new Set(requestedIds) : null;
  return assets.filter((asset) => (requested ? requested.has(asset.id) : asset.use_in_planning === 1));
}
