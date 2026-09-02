import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile, setBrandLogo } from "../../lib/brand-profile.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({ key: z.string().min(1).max(300) });

// Members may update their own logo at any time. The key must be one created
// by the authenticated member through /api/upload-reference; this prevents a
// caller from assigning another account's uploaded asset to their profile.
export const Route = createFileRoute("/api/brand-profile-logo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        if (!parsed.data.key.startsWith(`refs/${user.id}/`)) {
          return json({ ok: false, error: "archivo_no_autorizado" }, { status: 403 });
        }

        await setBrandLogo(user.id, parsed.data.key);
        return json({ ok: true });
      },
    },
  },
});
