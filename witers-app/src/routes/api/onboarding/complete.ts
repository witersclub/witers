import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { completeOnboarding } from "../../../lib/brand-profile.server";
import { getSessionUser, json } from "../../../lib/witers-auth.server";

const schema = z
  .object({
    companyName: z.string().min(2).max(120),
    brandColors: z.string().max(60).optional(),
    businessType: z.string().max(100).optional(),
    logoKey: z.string().max(300).optional(),
    noLogo: z.boolean().default(false),
    // Optional brand font files — comma-joined R2 keys, same shape as
    // design_requests.product_photo_keys. No "required unless skipped"
    // refine like logoKey below, since this step is genuinely optional
    // with no escape-hatch sentinel needed.
    fontKeys: z.string().max(2000).optional(),
  })
  .refine((data) => data.noLogo || Boolean(data.logoKey), {
    message: "Sube el logotipo o marca 'No tengo logotipo'.",
    path: ["logoKey"],
  });

// Finishes the mandatory brand-onboarding chat — writes the real, locked
// brand_profiles row (see brand-profile.server.ts) and clears the resumable
// draft. Every later design request reuses this row instead of asking
// company name/colors/category/logo again.
export const Route = createFileRoute("/api/onboarding/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const profile = await completeOnboarding(user.id, {
          companyName: parsed.data.companyName.trim(),
          brandColors: parsed.data.brandColors ?? null,
          businessType: parsed.data.businessType?.trim() || null,
          logoKey: parsed.data.noLogo ? null : (parsed.data.logoKey ?? null),
          fontKeys: parsed.data.fontKeys ?? null,
        });

        return json({ ok: true, profile });
      },
    },
  },
});
