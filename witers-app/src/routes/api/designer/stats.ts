import { createFileRoute } from "@tanstack/react-router";

import { currencyForCountry } from "../../../lib/geo-currency";
import { getFxRates } from "../../../lib/fx-rates.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

// Per-designer counts of pieces finalized by the client, real pay behind
// the "5 pieces = $250 MXN" progress bars in the designer panel ($50 MXN
// per piece — see DesignerStreakCard in witer.tsx). Images have an
// explicit client-confirm step (status becomes "cerrada" only after the
// client closes it — see /api/close-request); video and carousel
// requests have no such step, "completada" (delivered) is already their
// terminal state.
//
// Same geo-currency approach as /api/geo-price (membership cards): country
// comes straight from Cloudflare's edge request, never a separate GeoIP
// call, and the FX rate is the same cached table — this is a reference
// conversion for the designer's own benefit, never the actual pay
// currency (that's always MXN).
type CfRequest = Request & { cf?: { country?: string } };

export const Route = createFileRoute("/api/designer/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const [images, videos, carousels] = await Promise.all([
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM design_requests WHERE claimed_by = ?1 AND status = 'cerrada'",
            )
            .bind(auth.user.id)
            .first<{ n: number }>(),
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM video_requests WHERE claimed_by = ?1 AND status = 'completada'",
            )
            .bind(auth.user.id)
            .first<{ n: number }>(),
          db()
            .prepare(
              "SELECT COUNT(*) AS n FROM carousel_requests WHERE claimed_by = ?1 AND status = 'completada'",
            )
            .bind(auth.user.id)
            .first<{ n: number }>(),
        ]);

        const country = (request as CfRequest).cf?.country ?? null;
        const currency = currencyForCountry(country);
        let geo: { currency: string; rate: number } | null = null;
        if (currency) {
          const rates = await getFxRates();
          const rate = rates?.[currency] ?? (currency !== "USD" ? rates?.USD : undefined);
          const effectiveCurrency = rates && rates[currency] !== undefined ? currency : "USD";
          if (rates && rate !== undefined) {
            geo = { currency: effectiveCurrency, rate };
          }
        }

        return json({
          ok: true,
          images: images?.n ?? 0,
          videos: videos?.n ?? 0,
          carousels: carousels?.n ?? 0,
          geo,
        });
      },
    },
  },
});
