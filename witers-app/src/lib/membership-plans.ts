// Single source of truth for the 3 WITERS membership tiers — imported by the
// homepage pricing cards, the checkout flow, and the server-side checkout
// route, so the price/quota a client sees is always the price/quota they're
// actually charged and granted. Safe to import from both client and server
// code (no secrets, no side effects).

export type PlanId = "essential" | "grow" | "scale";

export type MembershipPlan = {
  id: PlanId;
  nombre: string;
  tagline: string;
  descripcion: string;
  precioPromo: number;
  precioRegular: number;
  requestsQuota: number;
  videoRequestsQuota: number;
  destacada?: boolean;
  beneficios: string[];
};

// El 30% de descuento aplica solo los primeros 3 meses consecutivos de
// suscripción — ver /terminos, sección 1.
export const PROMO_MESES = 3;

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "essential",
    nombre: "Essential",
    tagline: "Impulsa el inicio de tu marca",
    descripcion:
      "Ideal para emprendedores y pequeñas empresas que desean construir una imagen profesional y comenzar a atraer más clientes.",
    precioPromo: 5999.9,
    precioRegular: 8571.29,
    requestsQuota: 10,
    videoRequestsQuota: 0,
    beneficios: [
      "10 solicitudes de diseño al mes",
      "Hasta 2 revisiones por diseño",
      "2 campañas publicitarias",
      "Acompañamiento estratégico para tu marca",
      "Entregas en alta resolución, listas para publicar",
      "Panel exclusivo para dar seguimiento a cada solicitud",
    ],
  },
  {
    id: "grow",
    nombre: "Grow",
    tagline: "Acelera el crecimiento de tu negocio",
    descripcion:
      "Pensado para empresas que buscan aumentar su presencia digital con una estrategia de contenido más completa.",
    precioPromo: 12999.9,
    precioRegular: 18571.29,
    requestsQuota: 15,
    videoRequestsQuota: 2,
    destacada: true,
    beneficios: [
      "15 solicitudes de diseño al mes",
      "Hasta 2 revisiones por diseño",
      "2 carruseles para redes sociales",
      "2 videos para redes sociales",
      "3 campañas publicitarias",
      "Planeación estratégica de contenido",
      "Asesoría estratégica personalizada",
      "Reporte semanal de desempeño",
      "Panel exclusivo para dar seguimiento a cada solicitud",
    ],
  },
  {
    id: "scale",
    nombre: "Scale",
    tagline: "Escala tu marca con una estrategia integral",
    descripcion:
      "La solución más completa para empresas que buscan crecer de forma constante con estrategia, creatividad y análisis.",
    precioPromo: 16999.9,
    precioRegular: 24285.57,
    requestsQuota: 20,
    videoRequestsQuota: 4,
    beneficios: [
      "20 solicitudes de diseño al mes",
      "Hasta 3 revisiones por diseño",
      "4 carruseles para redes sociales",
      "4 videos para redes sociales",
      "4 campañas publicitarias",
      "Planeación estratégica de contenido",
      "Asesoría estratégica personalizada",
      "Reporte semanal de desempeño",
      "Auditoría mensual de estrategia y resultados",
      "Reunión mensual de seguimiento estratégico",
      "Prioridad alta en tiempos de entrega",
      "Panel exclusivo para dar seguimiento a cada solicitud",
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
