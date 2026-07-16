import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { generateAdCopy } from "../../lib/ad-copy.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  title: z.string().min(1).max(200),
  pieceBrief: z.string().max(2000).optional(),
  style: z.string().max(200).optional(),
  audience: z.string().max(200).optional(),
  companyName: z.string().max(120).optional(),
  objective: z.enum(["trafico", "interaccion", "ventas"]),
});

// Real ad copy for the pauta wizard's "mensajes" step, written by ChatGPT
// from the piece's own brief/style/audience instead of a fixed template.
export const Route = createFileRoute("/api/generate-ad-copy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const result = await generateAdCopy({
          title: parsed.data.title,
          pieceBrief: parsed.data.pieceBrief ?? null,
          style: parsed.data.style ?? null,
          audience: parsed.data.audience ?? null,
          companyName: parsed.data.companyName ?? null,
          objective: parsed.data.objective,
        });
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });
        return json({ ok: true, messages: result.messages });
      },
    },
  },
});
