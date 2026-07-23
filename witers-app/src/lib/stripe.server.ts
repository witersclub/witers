import Stripe from "stripe";

import { currentPriceFor, getPlan, type MembershipPlan } from "./membership-plans";

let client: Stripe | null = null;

// Workers' fetch-based runtime needs Stripe's fetch HTTP client instead of
// the Node http client the SDK defaults to — same nodejs_compat setup this
// app already uses for everything else, Stripe just needs telling.
export function stripeClient(): Stripe {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY no está configurada");
  client = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  return client;
}

export function stripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

// Same math as /api/checkout — kept in one place so the amount a client is
// shown, the amount a PaymentIntent charges, and the amount actually
// activated in the DB can never drift apart. `existing` is the caller's
// current membership row (or null/undefined for a first-time activation).
export function computeChargeAmount(
  plan: MembershipPlan,
  existing: { status: string; plan: string; activated_at: string | null } | null | undefined,
): { price: number; chargeAmount: number; isSwitch: boolean } {
  const price = currentPriceFor(plan, existing?.activated_at ?? null);
  const isSwitch = Boolean(existing?.status === "active" && existing.plan !== plan.id);
  if (!isSwitch) return { price, chargeAmount: price, isSwitch };
  const oldPrice = currentPriceFor(getPlan(existing!.plan), existing!.activated_at);
  return { price, chargeAmount: Math.max(0, price - oldPrice), isSwitch };
}

// MXN, like every other currency Stripe supports at 2 decimals, is charged
// in centavos — $5,999.90 MXN is amount: 599990, not 5999.90 or 5999.
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
