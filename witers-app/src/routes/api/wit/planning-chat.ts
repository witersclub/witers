import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../../lib/brand-profile.server";
import { getBrandMemory } from "../../../lib/brand-memory.server";
import { runWitPlanningBrief } from "../../../lib/wit-chat.server";
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
    .max(20),
});

// CAMBIO 02 — "Planificar con Wit": a free-text front door into the guided
// planning wizard (guided-planning-sheet.tsx). This is deliberately a thin
// interpretation step — it never touches calendar_entries or produces a
// plan itself, it only turns a client's own words into the same fields the
// structured wizard collects, for the client to review before the real
// generation (runWitCalendarChat, via /api/wit/calendar-chat) runs.
export const Route = createFileRoute("/api/wit/planning-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const result = await runWitPlanningBrief(parsed.data.messages, {
          companyName: profile.company_name,
          brandColors: profile.brand_colors,
          businessType: profile.business_type,
          hasLogo: Boolean(profile.logo_key),
          brandMemory: await getBrandMemory(user.id),
        });

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
