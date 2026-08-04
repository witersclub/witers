import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile, setBrandFont } from "../../lib/brand-profile.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  fontKeys: z.string().max(2000).optional(),
  libraryFont: z.string().max(120).optional(),
  clear: z.boolean().optional(),
});

// Lets a member set/replace/clear their own brand typography from the
// panel's "Activos de marca" section — freely, any time, same as colors
// (see brand-profile-colors.ts). fontKeys (uploaded files) and libraryFont
// (a Google Fonts pick) are mutually exclusive: whichever one the request
// sets wins and clears the other, enforced here rather than trusted from
// the client.
export const Route = createFileRoute("/api/brand-profile-font")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const profile = await getBrandProfile(user.id);
        if (!profile) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const { fontKeys, libraryFont, clear } = parsed.data;
        if (clear) {
          await setBrandFont(user.id, { fontKeys: null, libraryFont: null });
        } else if (libraryFont) {
          await setBrandFont(user.id, { fontKeys: null, libraryFont });
        } else if (fontKeys) {
          await setBrandFont(user.id, { fontKeys, libraryFont: null });
        } else {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        return json({ ok: true });
      },
    },
  },
});
