// CAMBIO 04B — single source of truth for "everything Wit knows about a
// brand" before any AI call. Before this, every route that talks to Wit
// (wit/chat.ts, wit/carousel-chat.ts, wit/calendar-chat.ts,
// calendar-entries-request.ts, calendar-entries-expand.ts...) rebuilt this
// object by hand from getBrandProfile + getBrandMemory +
// getPlanningBrandAssets — and two of them (wit/chat.ts,
// wit/carousel-chat.ts, the single-image/single-carousel conversations)
// had silently drifted to never call getPlanningBrandAssets at all, so a
// client's uploaded Mente de marca documents never reached Wit on those
// two flows even though the toggle said "sí, úsalo en planeación". Routing
// every caller through this one function is what actually fixes that, not
// just a rename.
import { getPlanningBrandAssets } from "./brand-assets.server";
import { getBrandMemory } from "./brand-memory.server";
import { getBrandProfile, type BrandProfile } from "./brand-profile.server";
import type { WitBrandContext } from "./wit-chat.server";

export async function buildBrandContext(
  userId: string,
  opts?: {
    // Explicit asset ids the client picked for this exact call (calendar
    // planning lets the client choose a subset) — when omitted, every
    // asset flagged use_in_planning=1 is included, same default
    // getPlanningBrandAssets already had.
    brandAssetIds?: string[];
    // Monthly plan generation packs many entries into one prompt and needs
    // a hard budget per asset; a single-piece conversation or expansion
    // can afford the full text. Omit for no truncation.
    maxAssetChars?: number;
  },
): Promise<{ profile: BrandProfile; context: WitBrandContext } | null> {
  const profile = await getBrandProfile(userId);
  if (!profile) return null;
  const [brandMemory, assets] = await Promise.all([
    getBrandMemory(userId),
    getPlanningBrandAssets(userId, opts?.brandAssetIds),
  ]);
  const cap = opts?.maxAssetChars;
  return {
    profile,
    context: {
      companyName: profile.company_name,
      brandColors: profile.brand_colors,
      businessType: profile.business_type,
      hasLogo: Boolean(profile.logo_key),
      brandMemory,
      brandAssets: assets.map((asset) => ({
        originalName: asset.original_name,
        kind: asset.kind,
        textContent: asset.text_content
          ? cap
            ? asset.text_content.slice(0, cap)
            : asset.text_content
          : null,
      })),
    },
  };
}
