// Approximate lat/lon for the pauta wizard's ubicación map preview only —
// Meta's own location search (meta-ads.server.ts) never returns
// coordinates, just an opaque `key` used for real targeting. This is
// purely visual (drawing a pin + radius circle), so imprecision here
// doesn't affect what's actually sent to Meta at campaign creation.
//
// Uses OpenStreetMap's free Nominatim geocoder — no API key, no billing
// account needed. Per its usage policy: identify the app via User-Agent,
// keep to light/occasional traffic (this only fires once per location a
// client picks, not per keystroke), and don't cache/redistribute results
// in bulk. If WITERS's traffic ever outgrows that, swap for a paid
// provider (Google Maps/Mapbox) without touching the targeting logic.
import process from "node:process";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = { lat: number; lon: number };

export async function geocodeApprox(
  query: string,
  countryCode: string,
): Promise<{ ok: true; data: GeocodeResult } | { ok: false; error: string }> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", countryCode.toLowerCase());
  url.searchParams.set("limit", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        // Nominatim's usage policy requires a real identifying User-Agent.
        "user-agent": `WITERS-Ads-Wizard/1.0 (${process.env.SUPPORT_CONTACT_EMAIL ?? "contacto via witers.com"})`,
      },
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const hit = results[0];
    if (!hit) return { ok: false, error: "sin_resultado" };
    return { ok: true, data: { lat: Number(hit.lat), lon: Number(hit.lon) } };
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }
}
