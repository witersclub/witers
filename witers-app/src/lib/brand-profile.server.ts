// One membership, one business: a member's brand identity (company name,
// brand colors, business category, logo) locks to whatever they submit on
// their first design request, so the same account can't be stretched
// across unrelated businesses request by request. Enforced here — in
// server code shared by every request-creation path (chat, classic form,
// or a direct API call) — rather than just hidden in one UI, since a UI
// restriction alone wouldn't actually stop anything.
import { db } from "./witers-auth.server";

export type BrandProfile = {
  user_id: string;
  company_name: string;
  brand_colors: string | null;
  business_type: string | null;
  logo_key: string | null;
};

export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  const row = await db()
    .prepare("SELECT * FROM brand_profiles WHERE user_id = ?1")
    .bind(userId)
    .first<BrandProfile>();
  return row ?? null;
}

// Called on every design-request submission. First time, this creates the
// lock from whatever was submitted. After that, the existing row always
// wins over newly submitted company name/colors — the caller should use
// the *returned* values when writing the request, not what the client
// sent. The one exception is logo_key: if it's still unset (the client's
// first submission skipped the logo), a real key offered later locks in
// right then instead of staying open forever.
export async function resolveBrandProfile(
  userId: string,
  submitted: {
    companyName: string;
    brandColors: string | null;
    businessType: string | null;
    logoKey: string | null;
  },
): Promise<BrandProfile> {
  const existing = await getBrandProfile(userId);
  if (!existing) {
    await db()
      .prepare(
        `INSERT INTO brand_profiles (user_id, company_name, brand_colors, business_type, logo_key)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
      .bind(
        userId,
        submitted.companyName,
        submitted.brandColors,
        submitted.businessType,
        submitted.logoKey,
      )
      .run();
    return {
      user_id: userId,
      company_name: submitted.companyName,
      brand_colors: submitted.brandColors,
      business_type: submitted.businessType,
      logo_key: submitted.logoKey,
    };
  }
  if (!existing.logo_key && submitted.logoKey) {
    await db()
      .prepare(
        "UPDATE brand_profiles SET logo_key = ?2, updated_at = datetime('now') WHERE user_id = ?1",
      )
      .bind(userId, submitted.logoKey)
      .run();
    return { ...existing, logo_key: submitted.logoKey };
  }
  return existing;
}
