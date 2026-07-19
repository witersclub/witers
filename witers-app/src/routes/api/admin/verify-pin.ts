import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";
import { z } from "zod";

import { json, requireAdminUser } from "../../../lib/witers-auth.server";

// The 4-digit code the admin panel asks for before opening "Editar
// usuario" — a UI speed bump against an accidental click, not a
// privilege boundary (that's already requireAdminUser below). Checked
// here, server-side, so the real value never ships in the client bundle:
// set it with `wrangler secret put ADMIN_EDIT_PIN` (see wrangler.jsonc).
// No hardcoded fallback — same fail-closed pattern as
// meta-ads.server.ts's getMetaConfig for a missing required secret,
// because a fallback baked into this file would defeat the entire point
// of moving the check server-side.
const schema = z.object({ code: z.string().min(1).max(20) });

export const Route = createFileRoute("/api/admin/verify-pin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false }, { status: 400 });

        const pin = process.env.ADMIN_EDIT_PIN;
        if (!pin) return json({ ok: false, error: "sin_configurar" }, { status: 500 });

        return json({ ok: parsed.data.code === pin });
      },
    },
  },
});
