import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({ requestId: z.string().uuid(), visible: z.boolean() });

// Admin-only: show/hide a specific request's logo on the public "Marcas que
// confían" wall without touching the underlying request or logo file — for
// cases like a client uploading a photo instead of a clean logotype, where
// the data is real but doesn't belong in that display.
export const Route = createFileRoute("/api/admin/toggle-logo-visibility")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const { requestId, visible } = parsed.data;

        const reqRow = await db()
          .prepare("SELECT id FROM design_requests WHERE id = ?1")
          .bind(requestId)
          .first<{ id: string }>();
        if (!reqRow) return json({ ok: false, error: "no_encontrado" }, { status: 404 });

        await db()
          .prepare("UPDATE design_requests SET logo_public = ?1 WHERE id = ?2")
          .bind(visible ? 1 : 0, requestId)
          .run();

        return json({ ok: true });
      },
    },
  },
});
