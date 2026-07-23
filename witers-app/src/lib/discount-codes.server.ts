import { db } from "./witers-auth.server";

export type DiscountCodeRow = {
  id: string;
  code: string;
  discount_percent: number;
};

// Codes are matched case-insensitively (normalized to uppercase, no
// surrounding whitespace) — same code an admin typed in Title Case or a
// client typed in lowercase both resolve to the same row.
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// Shared by /api/stripe/create-payment-intent (first validation, when the
// PaymentIntent is created) and /api/checkout (re-validated from the
// PaymentIntent's own metadata before activating anything) — a code that
// got deactivated or hit its max_uses between those two calls is rejected
// at whichever step catches it.
export async function validateDiscountCode(
  raw: string,
): Promise<{ ok: true; row: DiscountCodeRow } | { ok: false; error: string }> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, error: "codigo_invalido" };

  const row = await db()
    .prepare(
      `SELECT id, code, discount_percent, max_uses, uses_count, active, expires_at
       FROM discount_codes WHERE code = ?1`,
    )
    .bind(code)
    .first<{
      id: string;
      code: string;
      discount_percent: number;
      max_uses: number | null;
      uses_count: number;
      active: number;
      expires_at: string | null;
    }>();

  if (!row || !row.active) return { ok: false, error: "codigo_invalido" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "codigo_expirado" };
  }
  if (row.max_uses !== null && row.uses_count >= row.max_uses) {
    return { ok: false, error: "codigo_agotado" };
  }

  return { ok: true, row: { id: row.id, code: row.code, discount_percent: row.discount_percent } };
}

// Rounded to centavos, same as withIva() — never a fractional-centavo
// remainder for pesosToCentavos() to choke on downstream.
export function applyDiscount(pesos: number, discountPercent: number): number {
  const discounted = pesos * (1 - discountPercent / 100);
  return Math.max(0, Math.round(discounted * 100) / 100);
}

export async function recordDiscountCodeUse(code: string): Promise<void> {
  await db()
    .prepare("UPDATE discount_codes SET uses_count = uses_count + 1 WHERE code = ?1")
    .bind(code)
    .run();
}
