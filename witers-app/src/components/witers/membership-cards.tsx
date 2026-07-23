// Shared "ficha" markup for the 3 WITERS membership tiers — used by the
// homepage's marketing section and by /upgrade's plan-switch page. Visuals
// stay identical between both; only the CTA per card (and which plan, if
// any, reads as "current") differs, via the ctaFor callback.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { MEMBERSHIP_PLANS, PROMO_MESES, type MembershipPlan } from "../../lib/membership-plans";
import { useLanguage } from "../../lib/i18n";

type GeoPrice =
  | { ok: true; show: false }
  | { ok: true; show: true; currency: string; amounts: Record<string, number> };

// Reference-only conversion for a visitor outside Mexico — never the
// billing amount, which Stripe always charges in MXN regardless of what
// this shows. Fetched once per page load; a day-old rate is fine for a
// "roughly this much" line, so no need to refetch on every render/focus
// (see checkout.tsx's PaymentIntent staleTime for the same reasoning).
function useGeoPrice() {
  return useQuery({
    queryKey: ["geo-price"],
    queryFn: async () => {
      const res = await fetch("/api/geo-price", { credentials: "include" });
      if (!res.ok) return { ok: true, show: false } as GeoPrice;
      return (await res.json()) as GeoPrice;
    },
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}

// Essential stays brand blue; Grow (the "middle" tier) reads as platinum —
// a brushed silver gradient, not another shade of blue — and Scale reads as
// black, so the three cards feel like a visible step up rather than three
// blue boxes with different numbers.
export const TIER_HEADER_BG: Record<string, string> = {
  essential: "bg-wit-blue",
  grow: "bg-[linear-gradient(135deg,#aeb6c0,#6b7280_55%,#464b54)]",
  scale: "bg-[linear-gradient(135deg,#2a2a2d,#000000_60%,#000000)]",
};

export type PlanCta = {
  to: string;
  search?: Record<string, string>;
  label: string;
  disabled?: boolean;
};

export function MembershipPlanCards({ ctaFor }: { ctaFor: (plan: MembershipPlan) => PlanCta }) {
  const { t } = useLanguage();
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const geoPrice = useGeoPrice();
  const fmtGeo = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
    }
  };

  return (
    <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-3">
      {MEMBERSHIP_PLANS.map((m) => {
        const descuento = Math.round((1 - m.precioPromo / m.precioRegular) * 100);
        const cta = ctaFor(m);
        return (
          <div
            key={m.id}
            className={`relative flex flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_40px_120px_rgba(0,71,255,0.25)] ${
              m.destacada ? "ring-2 ring-[#9aa3b2] lg:-translate-y-4" : ""
            }`}
          >
            {m.destacada ? (
              <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-wit-blue shadow-[0_8px_20px_rgba(0,0,0,0.22)]">
                <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                {t("Más popular", "Most popular")}
              </span>
            ) : null}
            <div
              className={`px-7 pb-6 text-white ${m.destacada ? "pt-14" : "pt-6"} ${TIER_HEADER_BG[m.id]}`}
            >
              <p className="text-center text-lg font-extrabold uppercase tracking-[0.12em] text-white">
                WITERS {m.nombre}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-white/95">{m.tagline}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-white/50 line-through">{fmt(m.precioRegular)}</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  -{descuento}%
                </span>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-wit-mono text-4xl font-semibold leading-none">
                  {fmt(m.precioPromo)}
                </span>
                <span className="pb-1 text-xs font-semibold leading-tight text-white/85">
                  {t("MXN/mes", "MXN/mo")}
                  <br />
                  {t("+ IVA", "+ VAT")}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                {t(
                  `Precio especial válido tus primeros ${PROMO_MESES} meses. Del mes ${
                    PROMO_MESES + 1
                  } en adelante: ${fmt(m.precioRegular)} MXN + IVA al mes.`,
                  `Special price valid for your first ${PROMO_MESES} months. From month ${
                    PROMO_MESES + 1
                  } onward: ${fmt(m.precioRegular)} MXN + VAT per month.`,
                )}
              </p>
              {geoPrice.data?.ok && geoPrice.data.show ? (
                <p className="mt-1 text-[11px] font-semibold text-white/70">
                  ≈ {fmtGeo(geoPrice.data.amounts[m.id], geoPrice.data.currency)}
                  {t("/mes", "/mo")}
                </p>
              ) : null}
            </div>

            <p className="border-b border-wit-ink/10 px-7 py-5 text-sm leading-relaxed text-wit-gray">
              {m.descripcion}
            </p>

            <ul className="flex-1 space-y-3.5 px-7 py-7">
              {m.beneficios.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-wit-ink">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="#0047FF"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                  >
                    <path d="M3.5 10.5 8 15l8.5-9.5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>

            <div className="px-7 pb-7">
              {cta.disabled ? (
                <span className="block w-full rounded-2xl border border-wit-ink/15 px-6 py-3.5 text-center text-base font-bold text-wit-gray">
                  {cta.label}
                </span>
              ) : (
                <Link
                  to={cta.to}
                  search={cta.search}
                  className={`block w-full rounded-2xl px-6 py-3.5 text-center text-base font-bold text-white transition-all duration-200 active:scale-[0.99] ${
                    m.destacada
                      ? "bg-wit-blue hover:brightness-110"
                      : "bg-wit-navy hover:bg-wit-blue"
                  }`}
                >
                  {cta.label}
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
