import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/api/admin/deactivate-discount-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        await db()
          .prepare("UPDATE discount_codes SET active = 0 WHERE id = ?1")
          .bind(parsed.data.id)
          .run();

        return json({ ok: true });
      },
    },
  },
});
