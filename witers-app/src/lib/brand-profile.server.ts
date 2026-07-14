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
  brand_manual_key: string | null;
  logo_updated_at: string | null;
  colors_updated_at: string | null;
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
      brand_manual_key: null,
      logo_updated_at: null,
      colors_updated_at: null,
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

// Partial answers for the mandatory brand-onboarding chat (see
// panel.tsx's OnboardingGate), saved after every answer so an abandoned
// conversation resumes exactly where the client left it — same shape
// ChatIntakeFlow already expects for initialAnswers.
export async function getOnboardingDraft(userId: string): Promise<Record<string, string>> {
  const row = await db()
    .prepare("SELECT answers FROM brand_onboarding_drafts WHERE user_id = ?1")
    .bind(userId)
    .first<{ answers: string }>();
  if (!row) return {};
  try {
    return JSON.parse(row.answers) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function saveOnboardingDraft(
  userId: string,
  answers: Record<string, string>,
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO brand_onboarding_drafts (user_id, answers, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, updated_at = datetime('now')`,
    )
    .bind(userId, JSON.stringify(answers))
    .run();
}

export async function clearOnboardingDraft(userId: string): Promise<void> {
  await db().prepare("DELETE FROM brand_onboarding_drafts WHERE user_id = ?1").bind(userId).run();
}

// Finishes onboarding by writing the real, locked brand_profiles row —
// idempotent, since a client could in theory hit this twice (e.g. a
// double submit) or already have a profile from an old direct request.
export async function completeOnboarding(
  userId: string,
  data: {
    companyName: string;
    brandColors: string | null;
    businessType: string | null;
    logoKey: string | null;
  },
): Promise<BrandProfile> {
  const existing = await getBrandProfile(userId);
  if (existing) {
    await clearOnboardingDraft(userId);
    return existing;
  }
  await db()
    .prepare(
      `INSERT INTO brand_profiles (user_id, company_name, brand_colors, business_type, logo_key)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(userId, data.companyName, data.brandColors, data.businessType, data.logoKey)
    .run();
  await clearOnboardingDraft(userId);
  return {
    user_id: userId,
    company_name: data.companyName,
    brand_colors: data.brandColors,
    business_type: data.businessType,
    logo_key: data.logoKey,
    brand_manual_key: null,
    logo_updated_at: null,
    colors_updated_at: null,
  };
}

// 30-day cooldown between deliberate logo/colors changes made from
// "Activos de marca" — enforced here rather than only in the UI, so a
// direct API call can't skip it. The point isn't to stop a legitimate
// rebrand (that's still free the first time, and again after 30 days) —
// it's to make "swap brand identity before every request for a different
// business" impractical, which is the actual abuse this guards against.
export const BRAND_ASSET_COOLDOWN_DAYS = 30;

// lastChangedAt is a D1 datetime('now') string ("YYYY-MM-DD HH:MM:SS",
// UTC) or null if there's no deliberate change yet — a first-ever edit is
// always allowed regardless of how long the profile itself has existed.
export function brandAssetCooldownDaysLeft(lastChangedAt: string | null): number {
  if (!lastChangedAt) return 0;
  const last = new Date(`${lastChangedAt.replace(" ", "T")}Z`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const remainingMs = BRAND_ASSET_COOLDOWN_DAYS * dayMs - (Date.now() - last);
  return remainingMs > 0 ? Math.ceil(remainingMs / dayMs) : 0;
}

// Both called from the panel's "Activos de marca" section — unlike the
// company name/colors lock above, a member can freely (re)upload their own
// logo or brand manual any time; there's no business reason to block them
// from replacing their own asset. logo_updated_at only moves here, never
// from resolveBrandProfile's own "fill in a still-empty logo" case, so
// that one-time initial capture never itself starts the cooldown clock —
// only a deliberate edit through this function does.
export async function setBrandLogo(userId: string, logoKey: string): Promise<void> {
  await db()
    .prepare(
      "UPDATE brand_profiles SET logo_key = ?2, logo_updated_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?1",
    )
    .bind(userId, logoKey)
    .run();
}

export async function setBrandManual(userId: string, manualKey: string): Promise<void> {
  await db()
    .prepare(
      "UPDATE brand_profiles SET brand_manual_key = ?2, updated_at = datetime('now') WHERE user_id = ?1",
    )
    .bind(userId, manualKey)
    .run();
}

// Also freely editable from "Activos de marca" — colors are technically
// covered by the brand manual too, but the client asked for them to be
// manageable as their own thing in the same section. Same cooldown-clock
// reasoning as setBrandLogo above.
export async function setBrandColors(userId: string, colors: string): Promise<void> {
  await db()
    .prepare(
      "UPDATE brand_profiles SET brand_colors = ?2, colors_updated_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?1",
    )
    .bind(userId, colors)
    .run();
}
