import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { resolveBrandProfile } from "../../lib/brand-profile.server";
import { buildDesignPrompt } from "../../lib/design-prompt.server";
import { notifyStaffNewRequest } from "../../lib/mail.server";
import { polishPromptWithAI } from "../../lib/polish-prompt.server";
import { db, getMembership, getSessionUser, json } from "../../lib/witers-auth.server";

const createSchema = z
  .object({
    title: z.string().min(3).max(120),
    companyName: z.string().min(2).max(120),
    productName: z.string().max(120).optional(),
    pieceBrief: z.string().min(10).max(2000),
    style: z.string().max(200).optional(),
    // Not stored on design_requests — used once, the first time a member
    // ever submits, to seed brand_profiles. Every submission after that
    // reuses the locked value, so this is safe to just ignore then.
    businessType: z.string().max(100).optional(),
    aspectRatio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).default("1:1"),
    referenceKey: z.string().max(300).optional(),
    logoKey: z.string().max(300).optional(),
    noLogo: z.boolean().default(false),
    productPhotoKeys: z.array(z.string().max(300)).max(6).optional(),
    audience: z.string().max(200).optional(),
    ageRange: z.string().max(40).optional(),
    requiredText: z.string().max(500).optional(),
    brandColors: z.string().max(60).optional(),
    promoPrice: z.string().max(80).optional(),
    // Language the client's Wit conversation happened in — not persisted,
    // only used below to keep the staff-facing ai_prompt (and therefore the
    // final piece's on-image copy) in the client's own language instead of
    // always defaulting to Spanish.
    lang: z.enum(["es", "en"]).default("es"),
  })
  .refine((data) => data.noLogo || Boolean(data.logoKey), {
    message: "Sube el logotipo o marca 'No tengo logotipo'.",
    path: ["logoKey"],
  });

// Turns the first validation failure into a message a client can actually
// act on — "revisa tus respuestas" alone doesn't say which answer or why,
// which is exactly what silently swallowing this used to do.
const FIELD_LABELS: Record<string, string> = {
  title: "El título",
  companyName: "El nombre de la empresa",
  productName: "El nombre del producto",
  pieceBrief: "La descripción de la pieza",
  style: "El estilo",
  audience: "El público objetivo",
  ageRange: "El rango de edad",
  requiredText: "El mensaje o dato extra",
  brandColors: "Los colores de marca",
  promoPrice: "El precio o promoción",
  logoKey: "El logotipo",
  aspectRatio: "El formato",
};

function describeValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Revisa tus respuestas e intenta de nuevo.";
  const label = FIELD_LABELS[String(issue.path[0] ?? "")] ?? "Una de tus respuestas";
  // Phrased without a gendered adjective ("corto/a", "largo/a") on purpose —
  // FIELD_LABELS mixes masculine and feminine nouns, and this reads fine
  // either way instead of needing a per-field grammatical gender table.
  if (issue.code === "too_big") {
    return `${label} supera el máximo de ${issue.maximum} caracteres.`;
  }
  if (issue.code === "too_small") {
    return `${label} no llega al mínimo de ${issue.minimum} caracteres.`;
  }
  return `${label}: ${issue.message}`;
}

export type CreateImageRequestInput = {
  title: string;
  companyName: string;
  productName?: string | null;
  pieceBrief: string;
  style?: string | null;
  businessType?: string | null;
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  referenceKey?: string | null;
  logoKey?: string | null;
  noLogo?: boolean;
  productPhotoKeys?: string[];
  audience?: string | null;
  ageRange?: string | null;
  requiredText?: string | null;
  brandColors?: string | null;
  promoPrice?: string | null;
  lang: "es" | "en";
};

// The full "create an image request" business logic (quota check, brand
// lock/resolve, insert, quota increment, staff notification, best-effort AI
// prompt polish) — extracted so /api/calendar-entries-request can create a
// request from an already-planned calendar entry through the exact same
// path as the normal POST handler below, instead of a second copy that
// could drift out of sync on quota or columns.
export async function createImageRequest(
  userId: string,
  userName: string,
  data: CreateImageRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const membership = await getMembership(userId);
  if (!membership || membership.status !== "active") {
    return { ok: false, error: "sin_membresia", status: 403 };
  }
  if (membership.requests_used >= membership.requests_quota + membership.bonus_requests_quota) {
    return { ok: false, error: "sin_saldo", status: 403 };
  }

  const brand = await resolveBrandProfile(userId, {
    companyName: data.companyName.trim(),
    brandColors: data.brandColors ?? null,
    businessType: data.businessType?.trim() || null,
    logoKey: data.noLogo ? null : (data.logoKey ?? null),
  });

  const id = crypto.randomUUID();
  await db()
    .prepare(
      `INSERT INTO design_requests
         (id, user_id, title, brief, style, aspect_ratio, reference_key, audience, age_range, required_text, brand_colors, promo_price,
          company_name, product_name, piece_brief, logo_key, product_photo_keys)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
    )
    .bind(
      id,
      userId,
      data.title.trim(),
      "",
      data.style?.trim() ?? null,
      data.aspectRatio,
      data.referenceKey ?? null,
      data.audience?.trim() ?? null,
      data.ageRange ?? null,
      data.requiredText?.trim() ?? null,
      brand.brand_colors,
      data.promoPrice?.trim() ?? null,
      brand.company_name,
      data.productName?.trim() ?? null,
      data.pieceBrief.trim(),
      brand.logo_key,
      data.productPhotoKeys?.length ? JSON.stringify(data.productPhotoKeys) : null,
    )
    .run();

  await db()
    .prepare("UPDATE memberships SET requests_used = requests_used + 1 WHERE user_id = ?1")
    .bind(userId)
    .run();

  await notifyStaffNewRequest({
    title: data.title.trim(),
    clientName: userName,
    companyName: brand.company_name,
    panelUrl: "https://witers.com/witer",
  });

  try {
    const rawPrompt = buildDesignPrompt({
      companyName: brand.company_name,
      productName: data.productName?.trim() || null,
      pieceBrief: data.pieceBrief.trim(),
      style: data.style?.trim() || null,
      audience: data.audience?.trim() || null,
      ageRange: data.ageRange ?? null,
      brandColors: brand.brand_colors,
      promoPrice: data.promoPrice?.trim() || null,
      requiredText: data.requiredText?.trim() || null,
      aspectRatio: data.aspectRatio,
      hasLogo: Boolean(brand.logo_key),
      hasProductPhoto: Boolean(data.productPhotoKeys?.length),
      businessType: brand.business_type,
      lang: data.lang,
    });
    const result = await polishPromptWithAI(rawPrompt, data.lang);
    if (result.ok) {
      await db()
        .prepare("UPDATE design_requests SET ai_prompt = ?2 WHERE id = ?1")
        .bind(id, result.prompt)
        .run();
    } else {
      console.info("[api/requests] prompt polish failed", result.error);
    }
  } catch (err) {
    console.info("[api/requests] prompt polish threw", err);
  }

  return { ok: true, id };
}

export const Route = createFileRoute("/api/requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        // Only ever expose the single most recent delivered file — never
        // older, superseded revisions, whose r2_keys would otherwise let a
        // client bypass the one-download-per-request rule enforced in
        // /api/file by reading old URLs straight out of this response.
        // Shown while "completada" (still open, downloadable) and kept
        // visible (but locked, per /api/file) once "cerrada" so the client's
        // history doesn't just go blank after they download it. Also kept
        // visible during "cambio_solicitado" so the client still sees the
        // piece they're reporting an error on while it's under review.
        const rows = await db()
          .prepare(
            `SELECT r.*,
               CASE WHEN r.status IN ('completada', 'cerrada', 'cambio_solicitado') THEN (
                 SELECT json_group_array(json_object('id', id, 'kind', kind, 'image_url', image_url, 'r2_key', r2_key))
                 FROM (
                   SELECT id, kind, image_url, r2_key FROM request_results
                   WHERE request_id = r.id AND kind != 'draft'
                   ORDER BY created_at DESC
                   LIMIT 1
                 )
               ) ELSE NULL END AS results_json
             FROM design_requests r
             WHERE r.user_id = ?1
             ORDER BY r.created_at DESC`,
          )
          .bind(user.id)
          .all();

        return json({ ok: true, requests: rows.results ?? [] });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json(
            { ok: false, error: "datos_invalidos", message: describeValidationError(parsed.error) },
            { status: 400 },
          );
        }

        const result = await createImageRequest(user.id, user.name, parsed.data);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });
        return json({ ok: true, id: result.id });
      },
    },
  },
});
