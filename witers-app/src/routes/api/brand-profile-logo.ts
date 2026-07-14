import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  brandAssetCooldownDaysLeft,
  getBrandProfile,
  setBrandLogo,
} from "../../lib/brand-profile.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ key: z.string().min(1).max(300) });

// Lets a member (re)upload their own logo directly from the panel's
// "Activos de marca" section — separate from the locking rule in
// brand-profile.server.ts, which only stops a *request* from silently
// swapping the brand's logo; here the owner is explicitly managing their
// own asset, so a replace is allowed, just rate-limited (see
// brandAssetCooldownDaysLeft) so swapping brand identity before every
// request for a different business isn't practical.
export const Route = createFileRoute("/api/brand-profile-logo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const daysLeft = brandAssetCooldownDaysLeft(profile.logo_updated_at);
        if (daysLeft > 0) {
          return json({ ok: false, error: "en_espera", diasRestantes: daysLeft }, { status: 429 });
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        await setBrandLogo(user.id, parsed.data.key);
        return json({ ok: true });
      },
    },
  },
});
