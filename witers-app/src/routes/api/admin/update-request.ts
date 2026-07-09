import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["en_proceso", "completada", "rechazada"]),
  adminNote: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/admin/update-request")({
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
          .prepare(
            `UPDATE design_requests
             SET status = ?2, admin_note = COALESCE(?3, admin_note), updated_at = datetime('now')
             WHERE id = ?1`,
          )
          .bind(parsed.data.requestId, parsed.data.status, parsed.data.adminNote ?? null)
          .run();

        return json({ ok: true });
      },
    },
  },
});

