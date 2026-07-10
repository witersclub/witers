import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({ userId: z.string().uuid() });

// Admin-only: deactivate a designer account (soft delete — keeps their
// claimed/completed history intact, just blocks future logins). Scoped to
// role='designer' so this endpoint can't be used to lock out an admin.
export const Route = createFileRoute("/api/admin/deactivate-designer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const result = await db()
          .prepare("UPDATE users SET active = 0 WHERE id = ?1 AND role = 'designer'")
          .bind(parsed.data.userId)
          .run();
        if (!result.meta.changes) {
          return json({ ok: false, error: "no_encontrado" }, { status: 404 });
        }

        return json({ ok: true });
      },
    },
  },
});
