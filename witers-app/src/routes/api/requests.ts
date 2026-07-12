import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { resolveBrandProfile } from "../../lib/brand-profile.server";
import { notifyStaffNewRequest } from "../../lib/mail.server";
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
    productPhotoKey: z.string().max(300).optional(),
    audience: z.string().max(200).optional(),
    ageRange: z.string().max(40).optional(),
    requiredText: z.string().max(500).optional(),
    brandColors: z.string().max(60).optional(),
    promoPrice: z.string().max(80).optional(),
  })
  .refine((data) => data.noLogo || Boolean(data.logoKey), {
    message: "Sube el logotipo o marca 'No tengo logotipo'.",
    path: ["logoKey"],
  });

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
        // history doesn't just go blank after they download it.
        const rows = await db()
          .prepare(
            `SELECT r.*,
               CASE WHEN r.status IN ('completada', 'cerrada') THEN (
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

        const membership = await getMembership(user.id);
        if (!membership || membership.status !== "active") {
          return json({ ok: false, error: "sin_membresia" }, { status: 403 });
        }
        if (membership.requests_used >= membership.requests_quota) {
          return json({ ok: false, error: "sin_saldo" }, { status: 403 });
        }

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        // One membership serves one business: company name, brand colors,
        // and logo lock to whatever this member's first submission
        // contains, so a later submission can't quietly swap them for a
        // different business. This is enforced here — the one place every
        // request-creation path (chat, classic form, or a raw API call)
        // funnels through — not just hidden in a UI, and the *returned*
        // values (not whatever the client just sent) are what actually get
        // written below.
        const brand = await resolveBrandProfile(user.id, {
          companyName: parsed.data.companyName.trim(),
          brandColors: parsed.data.brandColors ?? null,
          businessType: parsed.data.businessType?.trim() || null,
          logoKey: parsed.data.noLogo ? null : (parsed.data.logoKey ?? null),
        });

        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO design_requests
               (id, user_id, title, brief, style, aspect_ratio, reference_key, audience, age_range, required_text, brand_colors, promo_price,
                company_name, product_name, piece_brief, logo_key, product_photo_key)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
          )
          .bind(
            id,
            user.id,
            parsed.data.title.trim(),
            // design_requests.brief is still NOT NULL at the DB level — no
            // longer collected from the client, so this is just satisfying
            // that constraint, not a real value.
            "",
            parsed.data.style?.trim() ?? null,
            parsed.data.aspectRatio,
            parsed.data.referenceKey ?? null,
            parsed.data.audience?.trim() ?? null,
            parsed.data.ageRange ?? null,
            parsed.data.requiredText?.trim() ?? null,
            brand.brand_colors,
            parsed.data.promoPrice?.trim() ?? null,
            brand.company_name,
            parsed.data.productName?.trim() ?? null,
            parsed.data.pieceBrief.trim(),
            brand.logo_key,
            parsed.data.productPhotoKey ?? null,
          )
          .run();

        await db()
          .prepare("UPDATE memberships SET requests_used = requests_used + 1 WHERE user_id = ?1")
          .bind(user.id)
          .run();

        await notifyStaffNewRequest({
          title: parsed.data.title.trim(),
          clientName: user.name,
          companyName: brand.company_name,
          panelUrl: "https://witers.com/witer",
        });

        return json({ ok: true, id });
      },
    },
  },
});
