import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildBrandContext } from "../../../lib/brand-context.server";
import { runWitCarouselChat } from "../../../lib/wit-chat.server";
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

// Same shape as /api/wit/chat, but guides the client toward a 4-slide
// carousel (title + brief per slide) instead of a single piece brief — see
// runWitCarouselChat.
export const Route = createFileRoute("/api/wit/carousel-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const brand = await buildBrandContext(user.id);
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const result = await runWitCarouselChat(parsed.data.messages, brand.context);

        if (!result.ok) return json(result, { status: 502 });
        return json(result);
      },
    },
  },
});
