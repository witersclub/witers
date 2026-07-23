import { createFileRoute } from "@tanstack/react-router";

import { currencyForCountry } from "../../lib/geo-currency";
import { getFxRates } from "../../lib/fx-rates.server";
import { MEMBERSHIP_PLANS, withIva } from "../../lib/membership-plans";
import { json } from "../../lib/witers-auth.server";

// Cloudflare populates `cf` on every request at the edge — not part of the
// standard DOM Request type, so this is the one safe local cast for it
// rather than pulling @cloudflare/workers-types into this file's global
// scope (see bindings.server.ts's note on why that's avoided elsewhere).
type CfRequest = Request & { cf?: { country?: string } };

export const Route = createFileRoute("/api/geo-price")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const country = (request as CfRequest).cf?.country ?? null;
        const currency = currencyForCountry(country);
        if (!currency) {
          return json({ ok: true, show: false });
        }

        const rates = await getFxRates();
        const rate = rates?.[currency] ?? (currency !== "USD" ? rates?.USD : undefined);
        const effectiveCurrency = rates && rates[currency] !== undefined ? currency : "USD";
        if (!rates || rate === undefined) {
          return json({ ok: true, show: false });
        }

        const amounts: Record<string, number> = {};
        for (const plan of MEMBERSHIP_PLANS) {
          amounts[plan.id] = Math.round(withIva(plan.precioPromo) * rate * 100) / 100;
        }

        return json({ ok: true, show: true, currency: effectiveCurrency, amounts });
      },
    },
  },
});
