import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile, setBrandColors } from "../../lib/brand-profile.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ colors: z.string().min(1).max(60) });

// Lets a member update their own brand colors from the panel's "Activos de
// marca" section — freely, any time, no restrictions.
export const Route = createFileRoute("/api/brand-profile-colors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        await setBrandColors(user.id, parsed.data.colors);
        return json({ ok: true });
      },
    },
  },
});
