// Provisional, UI-only configuration for "Servicio Ads" — the fee WITERS
// will eventually charge on top of what a client spends with Meta. There
// is no billing logic wired to this anywhere yet (no charge is created,
// nothing is invoiced); this exists only so the campaign wizard's review
// step can show a real, single-sourced number instead of a hardcoded
// percentage copy-pasted into more than one place.
//
// The real rate will depend on the client's WITERS membership plan once
// that mapping is built — this file is where that mapping should live
// when it exists. Until then every caller gets the same provisional
// default tier.
export type AdsServiceTier = "starter" | "growth" | "pro";

export const ADS_SERVICE_RATE_BY_TIER: Record<AdsServiceTier, number> = {
  starter: 0.15,
  growth: 0.1,
  pro: 0.05,
};

// No real membership → tier mapping exists yet (the campaign wizard
// doesn't currently receive the client's plan at all) — this is the
// provisional tier every client sees until that's connected.
export const DEFAULT_ADS_SERVICE_TIER: AdsServiceTier = "growth";

export function getAdsServiceRate(tier: AdsServiceTier = DEFAULT_ADS_SERVICE_TIER): number {
  return ADS_SERVICE_RATE_BY_TIER[tier];
}
