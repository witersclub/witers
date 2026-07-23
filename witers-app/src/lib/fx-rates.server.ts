// Cached exchange rates (base MXN) for the "approximate price in your
// currency" line on the membership cards — see /api/geo-price and
// geo-currency.ts. Never touches billing: Stripe always charges MXN
// regardless of what this returns, this is purely a reference display.
// Backed by open.er-api.com — free, no API key, no rate limit that a
// once-a-day fetch could ever hit.
import { db } from "./witers-auth.server";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type FxCacheRow = { rates_json: string; fetched_at: string };

async function fetchFreshRates(): Promise<Record<string, number> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/MXN", {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body.result !== "success" || !body.rates) return null;
    return body.rates;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Returns rates as "units of that currency per 1 MXN" (e.g. rates.USD ===
// 0.058 means $1 MXN ≈ $0.058 USD). Null only if we've never successfully
// fetched AND the live fetch also fails right now — callers should treat
// that as "don't show a conversion", never guess.
export async function getFxRates(): Promise<Record<string, number> | null> {
  const cached = await db()
    .prepare("SELECT rates_json, fetched_at FROM fx_rates_cache WHERE id = 1")
    .first<FxCacheRow>();

  const isFresh = cached && Date.now() - new Date(cached.fetched_at + "Z").getTime() < MAX_AGE_MS;
  if (isFresh) {
    try {
      return JSON.parse(cached.rates_json) as Record<string, number>;
    } catch {
      // fall through to refetch — a corrupted cache row shouldn't wedge this forever
    }
  }

  const fresh = await fetchFreshRates();
  if (fresh) {
    await db()
      .prepare(
        `INSERT INTO fx_rates_cache (id, rates_json, fetched_at) VALUES (1, ?1, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET rates_json = excluded.rates_json, fetched_at = excluded.fetched_at`,
      )
      .bind(JSON.stringify(fresh))
      .run();
    return fresh;
  }

  // Fetch failed (e.g. transient outage) — serve stale cache rather than
  // nothing, if we have any at all. A day-old reference price is still
  // far more useful than no price, and this is never the billing amount.
  if (cached) {
    try {
      return JSON.parse(cached.rates_json) as Record<string, number>;
    } catch {
      return null;
    }
  }
  return null;
}
