// Single source of truth for the 3 WITERS membership tiers — imported by the
// homepage pricing cards, the checkout flow, and the server-side checkout
// route, so the price/quota a client sees is always the price/quota they're
// actually charged and granted. Safe to import from both client and server
// code (no secrets, no side effects).

export type PlanId = "mensual" | "plus";

export type MembershipPlan = {
  id: PlanId;
  nombre: string;
  tagline: string;
  descripcion: string;
  precioPromo: number;
  precioRegular: number;
  // One shared monthly pool, spendable on any mix of imagen/video/carrusel
  // — there is no separate per-format cap. planningSlotsPerDay is the only
  // other constraint: how many of that pool Wit may place on the same
  // calendar day.
  requestsQuota: number;
  /** Maximum number of pieces Wit may place on the same calendar date. */
  planningSlotsPerDay: 1 | 2;
  destacada?: boolean;
  beneficios: string[];
};

// Billing remains disabled while WITERS is in its administrator-activation
// phase. These values are nevertheless the single source of truth used by
// the admin activation UI and by Wit when it plans a calendar.
export const PROMO_MESES = 0;

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "mensual",
    nombre: "WITERS Mensual",
    tagline: "Un mes de contenido, listo para tu marca",
    descripcion:
      "Ideal para emprendedores y pequeñas empresas que desean construir una imagen profesional y comenzar a atraer más clientes.",
    precioPromo: 599,
    precioRegular: 599,
    requestsQuota: 30,
    planningSlotsPerDay: 1,
    beneficios: [
      "Hasta 30 piezas de contenido al mes",
      "Una publicación por día como máximo",
      "Imagen, video o carrusel — tú decides la mezcla",
      "Planificación mensual con Wit",
    ],
  },
  {
    id: "plus",
    nombre: "WITERS Plus",
    tagline: "Más ritmo para marcas que publican dos veces al día",
    descripcion:
      "Pensado para empresas que buscan aumentar su presencia digital con una estrategia de contenido más completa.",
    precioPromo: 899,
    precioRegular: 899,
    requestsQuota: 60,
    planningSlotsPerDay: 2,
    destacada: true,
    beneficios: [
      "Hasta 60 piezas de contenido al mes",
      "Hasta dos publicaciones por día",
      "Imagen, video o carrusel — tú decides la mezcla",
      "Planificación mensual con Wit",
    ],
  },
];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && MEMBERSHIP_PLANS.some((p) => p.id === value);
}

export function getPlan(id: string | null | undefined): MembershipPlan {
  return MEMBERSHIP_PLANS.find((p) => p.id === id) ?? MEMBERSHIP_PLANS[0];
}

function monthsSince(dateIso: string): number {
  const then = new Date(dateIso).getTime();
  const days = (Date.now() - then) / (1000 * 60 * 60 * 24);
  return Math.floor(days / 30);
}

// The price a member should be charged/see right now: promo price for their
// first PROMO_MESES months of continuous subscription (tracked from the
// membership's original activated_at), regular price after that.
export function currentPriceFor(plan: MembershipPlan, activatedAt: string | null): number {
  if (!activatedAt) return plan.precioPromo;
  return monthsSince(activatedAt) < PROMO_MESES ? plan.precioPromo : plan.precioRegular;
}

// Every published price (plan cards, /terminos) is stated "más IVA" — the
// number a client is shown and charged is never the bare plan price, it's
// always this. Rounded to centavos so downstream cents conversion for
// Stripe (pesosToCentavos) never carries a fractional-centavo remainder.
export const IVA_RATE = 0.16;
export function withIva(pesos: number): number {
  return Math.round(pesos * (1 + IVA_RATE) * 100) / 100;
}
