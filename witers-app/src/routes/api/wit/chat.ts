import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../../lib/brand-profile.server";
import { runWitChat } from "../../../lib/wit-chat.server";
import { getSessionUser, json } from "../../../lib/witers-auth.server";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .min(1)
    .max(60),
});

// One turn of the live "Wit" conversation used to create a design request
// (panel.tsx's WitConversation) — the client always resends the whole
// transcript, this call is otherwise stateless. Requires a completed brand
// profile: the mandatory onboarding chat (see /api/onboarding) is what
// this conversation leans on to never ask company name/colors/category/
// logo again.
export const Route = createFileRoute("/api/wit/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const result = await runWitChat(parsed.data.messages, {
          companyName: profile.company_name,
          brandColors: profile.brand_colors,
          businessType: profile.business_type,
          hasLogo: Boolean(profile.logo_key),
        });

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
