import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { bindings } from "../../../lib/bindings.server";
import { db, json, requireStaffUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  resultId: z.string().uuid(),
});

// Staff-only (admin or designer): delete an AI-generated draft (kind='draft')
// that was never approved — it was never visible to the client.
export const Route = createFileRoute("/api/admin/discard-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireStaffUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_autorizado" }, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare("SELECT r2_key FROM request_results WHERE id = ?1 AND kind = 'draft'")
          .bind(parsed.data.resultId)
          .first<{ r2_key: string | null }>();
        if (!row) return json({ ok: false, error: "no_existe" }, { status: 404 });

        await db()
          .prepare("DELETE FROM request_results WHERE id = ?1")
          .bind(parsed.data.resultId)
          .run();

        const { STORAGE } = bindings();
        if (STORAGE && row.r2_key) {
          await STORAGE.delete(row.r2_key);
        }

        return json({ ok: true });
      },
    },
  },
});
