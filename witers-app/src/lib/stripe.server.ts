import Stripe from "stripe";

import { currentPriceFor, getPlan, withIva, type MembershipPlan } from "./membership-plans";

let client: Stripe | null = null;

// Workers' fetch-based runtime needs Stripe's fetch HTTP client instead of
// the Node http client the SDK defaults to — same nodejs_compat setup this
// app already uses for everything else, Stripe just needs telling.
// telemetry: false matters more than it looks — the SDK otherwise fires a
// best-effort, never-awaited "request latency" ping after the main call
// resolves. Workers tears down a request's I/O the moment the handler's
// response is returned, and that orphaned fetch is exactly the kind of
// dangling promise that can surface as "the Promise did not resolve to
// Response" instead of a clean error.
export function stripeClient(): Stripe {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY no está configurada");
  client = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    telemetry: false,
  });
  return client;
}

export function stripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

// Same math as /api/checkout — kept in one place so the amount a client is
// shown, the amount a PaymentIntent charges, and the amount actually
// activated in the DB can never drift apart. `existing` is the caller's
// current membership row (or null/undefined for a first-time activation).
//
// `price`/`chargeAmount` stay pre-tax — that's the plan's list price
// (matches the homepage cards and memberships.price_mxn, a plan-price
// snapshot, not a billing record). `chargeAmountWithIva` is what's actually
// charged and what payments.amount_mxn records — every published price is
// "más IVA" (see /terminos), so the real charge is never the bare number.
export function computeChargeAmount(
  plan: MembershipPlan,
  existing: { status: string; plan: string; activated_at: string | null } | null | undefined,
): { price: number; chargeAmount: number; chargeAmountWithIva: number; isSwitch: boolean } {
  const price = currentPriceFor(plan, existing?.activated_at ?? null);
  const isSwitch = Boolean(existing?.status === "active" && existing.plan !== plan.id);
  if (!isSwitch) {
    return { price, chargeAmount: price, chargeAmountWithIva: withIva(price), isSwitch };
  }
  const oldPrice = currentPriceFor(getPlan(existing!.plan), existing!.activated_at);
  const chargeAmount = Math.max(0, price - oldPrice);
  return { price, chargeAmount, chargeAmountWithIva: withIva(chargeAmount), isSwitch };
}

// MXN, like every other currency Stripe supports at 2 decimals, is charged
// in centavos — $5,999.90 MXN is amount: 599990, not 5999.90 or 5999.
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
