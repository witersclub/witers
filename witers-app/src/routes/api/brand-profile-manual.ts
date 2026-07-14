import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile, setBrandManual } from "../../lib/brand-profile.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ key: z.string().min(1).max(300) });

// Lets a member upload (or replace) their own brand manual from the
// panel's "Activos de marca" section — no onboarding equivalent exists for
// this field, so this is the only place it's ever set.
export const Route = createFileRoute("/api/brand-profile-manual")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        await setBrandManual(user.id, parsed.data.key);
        return json({ ok: true });
      },
    },
  },
});
