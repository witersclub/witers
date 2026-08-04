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
  // Comma-joined R2 keys for optional font files collected during
  // onboarding (see completeOnboarding) — null if the client skipped that
  // step. Never locked like logo_key: nothing else depends on it staying
  // fixed once set.
  font_keys: string | null;
  // A Google Fonts family name (e.g. "Playfair Display"), chosen from the
  // built-in library instead of an uploaded file — see GoogleFontPicker.
  // Mutually exclusive with font_keys in practice (setBrandFont clears
  // whichever one isn't being set), never both populated by the UI.
  library_font: string | null;
  // Facebook Page this client's ads publish from — set only by an admin
  // (see /api/admin/update-brand-profile), never by the client. Null blocks
  // "Quiero pautar" for them; there's no shared/default Page fallback.
  meta_page_id: string | null;
  // The client's OWN Meta ad account id (numeric, no "act_" prefix) — set
  // only by an admin once the client has added WITERS's Business Portfolio
  // as a partner on it. Null means staff can't pull live campaigns for the
  // Campañas dashboard yet (see /api/admin/meta-campaigns).
  meta_ad_account_id: string | null;
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
      font_keys: null,
      library_font: null,
      meta_page_id: null,
      meta_ad_account_id: null,
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
    fontKeys: string | null;
    libraryFont: string | null;
  },
): Promise<BrandProfile> {
  const existing = await getBrandProfile(userId);
  if (existing) {
    await clearOnboardingDraft(userId);
    return existing;
  }
  await db()
    .prepare(
      `INSERT INTO brand_profiles (user_id, company_name, brand_colors, business_type, logo_key, font_keys, library_font)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      userId,
      data.companyName,
      data.brandColors,
      data.businessType,
      data.logoKey,
      data.fontKeys,
      data.libraryFont,
    )
    .run();
  await clearOnboardingDraft(userId);
  return {
    user_id: userId,
    company_name: data.companyName,
    brand_colors: data.brandColors,
    business_type: data.businessType,
    logo_key: data.logoKey,
    brand_manual_key: null,
    font_keys: data.fontKeys,
    library_font: data.libraryFont,
    meta_page_id: null,
    meta_ad_account_id: null,
  };
}

// Called from the panel's "Activos de marca" section — a member can freely
// (re)upload their own brand manual any time; there's no business reason
// to block them from replacing their own asset. Logo is deliberately NOT
// here: it stays fixed once set, changed only through support (see
// panel.tsx's LogoCard "Solicitar cambio de logotipo").
export async function setBrandManual(userId: string, manualKey: string): Promise<void> {
  await db()
    .prepare(
      "UPDATE brand_profiles SET brand_manual_key = ?2, updated_at = datetime('now') WHERE user_id = ?1",
    )
    .bind(userId, manualKey)
    .run();
}

// Colors are technically covered by the brand manual too, but the client
// asked for them to be manageable as their own thing in the same section —
// and, unlike the logo, freely editable any time, no restrictions.
export async function setBrandColors(userId: string, colors: string): Promise<void> {
  await db()
    .prepare(
      "UPDATE brand_profiles SET brand_colors = ?2, updated_at = datetime('now') WHERE user_id = ?1",
    )
    .bind(userId, colors)
    .run();
}

// Same "freely editable any time" rule as colors — set from the panel's
// "Activos de marca" section (BrandFontCard) after onboarding too, not just
// during it. Uploading a file clears any previously-chosen library font and
// vice versa: the UI only ever offers one or the other, never both at once.
export async function setBrandFont(
  userId: string,
  font: { fontKeys: string | null; libraryFont: string | null },
): Promise<void> {
  await db()
    .prepare(
      `UPDATE brand_profiles SET font_keys = ?2, library_font = ?3, updated_at = datetime('now')
       WHERE user_id = ?1`,
    )
    .bind(userId, font.fontKeys, font.libraryFont)
    .run();
}
