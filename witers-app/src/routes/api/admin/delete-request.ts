import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { bindings } from "../../../lib/bindings.server";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({ requestId: z.string().uuid() });

// Admin-only: permanently delete a finalized ("cerrada") request — the
// record, every result row, and the underlying R2 files. Scoped to cerrada
// only so this can't be used to wipe out work still in progress.
export const Route = createFileRoute("/api/admin/delete-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const { requestId } = parsed.data;

        const reqRow = await db()
          .prepare("SELECT id, status FROM design_requests WHERE id = ?1")
          .bind(requestId)
          .first<{ id: string; status: string }>();
        if (!reqRow) return json({ ok: false, error: "no_encontrado" }, { status: 404 });
        if (reqRow.status !== "cerrada") {
          return json({ ok: false, error: "no_finalizada" }, { status: 409 });
        }

        const results = await db()
          .prepare("SELECT r2_key FROM request_results WHERE request_id = ?1")
          .bind(requestId)
          .all<{ r2_key: string | null }>();

        const { STORAGE } = bindings();
        if (STORAGE) {
          for (const r of results.results ?? []) {
            if (r.r2_key) await STORAGE.delete(r.r2_key).catch(() => null);
          }
        }

        await db().prepare("DELETE FROM request_results WHERE request_id = ?1").bind(requestId).run();
        await db().prepare("DELETE FROM design_requests WHERE id = ?1").bind(requestId).run();

        return json({ ok: true });
      },
    },
  },
});
