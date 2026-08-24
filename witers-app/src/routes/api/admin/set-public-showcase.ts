import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

// Toggles whether one account's pieces/reviews/logo can be pulled into the
// homepage's public showcases (see 0039 migration and /api/public/showcase,
// /api/public/reviews, /api/public/brands, which all filter on this column).
const schema = z.object({
  userId: z.string().uuid(),
  publicShowcase: z.boolean(),
});

export const Route = createFileRoute("/api/admin/set-public-showcase")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_admin" }, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        await db()
          .prepare("UPDATE users SET public_showcase = ?1 WHERE id = ?2")
          .bind(parsed.data.publicShowcase ? 1 : 0, parsed.data.userId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
