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
  // The month the client actually has open in Planificación (from the
  // panel's month arrows) — optional, defaults to the server's real current
  // month. Without this, Wit always planned "today's real month" no matter
  // which month the client navigated to, so a client trying to plan ahead
  // for next month kept getting this month's plan back instead.
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthContext(target?: { year: number; month: number }): {
  monthLabel: string;
  todayDate: string;
  monthEndDate: string;
} {
  const now = new Date();
  const year = target?.year ?? now.getUTCFullYear();
  const month = target?.month ?? now.getUTCMonth() + 1;
  const monthStartDate = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const monthLabel = monthStartDate.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const todayIso = iso(now);
  const monthStartIso = iso(monthStartDate);
  const monthEndIso = iso(monthEnd);
  // Earliest date Wit is allowed to propose: today, but only when today
  // actually falls inside the target month — a future month has no "today"
  // constraint (starts from day 1), and a past month gets no constraint
  // either (nothing left to plan going forward in it).
  const lowerBound = todayIso < monthStartIso || todayIso > monthEndIso ? monthStartIso : todayIso;
  return { monthLabel, todayDate: lowerBound, monthEndDate: monthEndIso };
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
          monthContext(
            parsed.data.year && parsed.data.month
              ? { year: parsed.data.year, month: parsed.data.month }
              : undefined,
          ),
        );

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
