import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildDesignPrompt } from "../../../lib/design-prompt.server";
import { generateDraftForRequest } from "../../../lib/generate-draft.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  // Both optional: if omitted, the prompt/aspect ratio are built from the
  // request's own stored data (and its locked brand profile), same as the
  // automatic generation triggered on submission. An explicit prompt lets
  // staff tweak wording before regenerating.
  prompt: z.string().min(5).max(4000).optional(),
  aspectRatio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).optional(),
});

type RequestRow = {
  id: string;
  aspect_ratio: string;
  company_name: string | null;
  product_name: string | null;
  piece_brief: string | null;
  style: string | null;
  audience: string | null;
  age_range: string | null;
  brand_colors: string | null;
  promo_price: string | null;
  required_text: string | null;
  logo_key: string | null;
  business_type: string | null;
};

// Staff-only (admin or designer): generate the ad creative for a member
// request with OpenAI's GPT Image model. Requires the OPENAI_API_KEY secret
// (Runtime environment → Variables and secrets). Get a key at
// https://platform.openai.com/api-keys. The result is stored as a DRAFT —
// an admin must still approve it (with the approval code) via
// /api/admin/approve-result before it becomes visible to the client.
export const Route = createFileRoute("/api/admin/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_autorizado" }, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare(
            `SELECT r.id, r.aspect_ratio, r.company_name, r.product_name, r.piece_brief, r.style,
                    r.audience, r.age_range, r.brand_colors, r.promo_price, r.required_text, r.logo_key,
                    b.business_type AS business_type
             FROM design_requests r
             LEFT JOIN brand_profiles b ON b.user_id = r.user_id
             WHERE r.id = ?1`,
          )
          .bind(parsed.data.requestId)
          .first<RequestRow>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });

        const aspectRatio = parsed.data.aspectRatio ?? row.aspect_ratio;
        const prompt =
          parsed.data.prompt ??
          buildDesignPrompt({
            companyName: row.company_name,
            productName: row.product_name,
            pieceBrief: row.piece_brief,
            style: row.style,
            audience: row.audience,
            ageRange: row.age_range,
            brandColors: row.brand_colors,
            promoPrice: row.promo_price,
            requiredText: row.required_text,
            aspectRatio,
            hasLogo: Boolean(row.logo_key),
            businessType: row.business_type,
          });

        const result = await generateDraftForRequest(row.id, prompt, aspectRatio);
        if (!result.ok) {
          const status = result.error === "tiempo_agotado" ? 504 : 502;
          return json({ ok: false, error: result.error }, { status });
        }

        return json({ ok: true, keys: result.keys });
      },
    },
  },
});
