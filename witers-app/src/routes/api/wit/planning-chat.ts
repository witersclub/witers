import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildBrandContext } from "../../../lib/brand-context.server";
import { runWitPlanningBrief } from "../../../lib/wit-chat.server";
import { getSessionUser, json } from "../../../lib/witers-auth.server";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Generous headroom over what either side should normally send —
        // runWitPlanningBrief now caps its own text replies well under
        // this, but a wider ceiling here is a second line of defense
        // rather than the only thing standing between a slightly-too-long
        // message and the whole conversation breaking with a generic
        // "Wit no está disponible" error.
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(20),
  monthLabel: z.string().max(60).optional(),
  // "adjust" tells Wit it's editing a plan that already exists, and
  // existingEntries (from the client's own already-loaded calendar) is what
  // it uses to talk about that plan without re-fetching or re-deriving it.
  mode: z.enum(["create", "adjust"]).optional(),
  existingEntries: z
    .array(
      z.object({
        date: z.string(),
        format: z.enum(["imagen", "video", "carrusel"]),
        title: z.string().max(200),
      }),
    )
    .max(60)
    .optional(),
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

        const brand = await buildBrandContext(user.id);
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const result = await runWitPlanningBrief(parsed.data.messages, brand.context, {
          monthLabel: parsed.data.monthLabel ?? "",
          mode: parsed.data.mode ?? "create",
          existingEntries: parsed.data.existingEntries ?? [],
        });

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
