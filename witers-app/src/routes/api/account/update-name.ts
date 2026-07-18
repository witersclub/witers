import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../../lib/witers-auth.server";

const schema = z.object({
  name: z.string().min(2).max(80),
});

// Client-only self-service rename — email stays read-only (changing it would
// need re-verification we don't have yet; support handles that by hand).
export const Route = createFileRoute("/api/account/update-name")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const name = parsed.data.name.trim();
        await db().prepare("UPDATE users SET name = ?1 WHERE id = ?2").bind(name, user.id).run();

        return json({ ok: true, name });
      },
    },
  },
});
