import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { interpretVideoIdea } from "../../lib/wit-video-idea.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ text: z.string().min(5).max(2000) });

export const Route = createFileRoute("/api/wit-video-idea")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const result = await interpretVideoIdea(parsed.data.text.trim());
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });

        return json({ ok: true, title: result.title, purpose: result.purpose });
      },
    },
  },
});
