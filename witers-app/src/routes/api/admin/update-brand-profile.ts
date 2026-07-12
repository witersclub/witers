import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../../lib/brand-profile.server";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Admin-only override for the lock in /api/requests — a member's brand
// identity is fixed to their first submission, so the only way to
// correct it (a real rebrand, a mistake on their first request) is a
// staff member editing it here.
const schema = z.object({
  userId: z.string().uuid(),
  companyName: z.string().min(2).max(120),
  brandColors: z.string().max(60).optional(),
  businessType: z.string().max(100).optional(),
  // undefined = leave the current logo alone, null = clear it (reopens the
  // logo question for that member), a string = set/replace it.
  logoKey: z.string().max(300).nullable().optional(),
});

export const Route = createFileRoute("/api/admin/update-brand-profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const existing = await getBrandProfile(parsed.data.userId);
        const nextLogoKey =
          parsed.data.logoKey === undefined ? (existing?.logo_key ?? null) : parsed.data.logoKey;

        await db()
          .prepare(
            `INSERT INTO brand_profiles (user_id, company_name, brand_colors, business_type, logo_key)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(user_id) DO UPDATE SET
               company_name = ?2, brand_colors = ?3, business_type = ?4, logo_key = ?5, updated_at = datetime('now')`,
          )
          .bind(
            parsed.data.userId,
            parsed.data.companyName.trim(),
            parsed.data.brandColors?.trim() || null,
            parsed.data.businessType?.trim() || null,
            nextLogoKey,
          )
          .run();

        return json({ ok: true });
      },
    },
  },
});
