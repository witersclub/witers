import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({ id: z.string().uuid() });

// Hard delete. Safe against payment history: payments.discount_code is a
// plain text snapshot of the code at the time it was used, not a foreign
// key to this table, so removing the code here never touches past payments.
export const Route = createFileRoute("/api/admin/delete-discount-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        await db().prepare("DELETE FROM discount_codes WHERE id = ?1").bind(parsed.data.id).run();

        return json({ ok: true });
      },
    },
  },
});
