import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../../lib/brand-profile.server";
import { runWitCalendarChat } from "../../../lib/wit-chat.server";
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

function currentMonthContext(): { monthLabel: string; todayDate: string; monthEndDate: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const monthLabel = now.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { monthLabel, todayDate: iso(now), monthEndDate: iso(monthEnd) };
}

// Same shape as /api/wit/chat and /api/wit/carousel-chat, but guides the
// client toward planning the whole month's content calendar at once instead
// of one piece — see runWitCalendarChat.
export const Route = createFileRoute("/api/wit/calendar-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const result = await runWitCalendarChat(
          parsed.data.messages,
          {
            companyName: profile.company_name,
            brandColors: profile.brand_colors,
            businessType: profile.business_type,
            hasLogo: Boolean(profile.logo_key),
          },
          currentMonthContext(),
        );

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
