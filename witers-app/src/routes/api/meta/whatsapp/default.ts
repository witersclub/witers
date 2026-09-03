import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../../../lib/brand-profile.server";
import { getMetaAdOAuthAccessToken } from "../../../../lib/meta-ad-account-connection.server";
import { listMetaWhatsAppNumbers } from "../../../../lib/meta-whatsapp.server";
import { db, getSessionUser, json } from "../../../../lib/witers-auth.server";

const schema = z.object({ displayNumber: z.string().min(6).max(40) });

// Saves this client's usual WhatsApp destination — re-verified against
// their own connected Meta login on every save, never just trusted from
// the request body (the whole point of a default is that it stays a real,
// still-connected number, not whatever string a client last typed).
export const Route = createFileRoute("/api/meta/whatsapp/default")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const brandProfile = await getBrandProfile(user.id);
        const adAccountId = brandProfile?.meta_ad_account_id ?? null;
        const oauthAccessToken = adAccountId
          ? await getMetaAdOAuthAccessToken(user.id, adAccountId)
          : null;
        if (!oauthAccessToken) {
          return json({ ok: false, error: "cuenta_no_conectada" }, { status: 409 });
        }

        const result = await listMetaWhatsAppNumbers(oauthAccessToken);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: 502 });
        const match = result.numbers.some((n) => n.displayNumber === parsed.data.displayNumber);
        if (!match) return json({ ok: false, error: "numero_no_disponible" }, { status: 409 });

        await db()
          .prepare(
            "UPDATE brand_profiles SET default_whatsapp_number = ?2, updated_at = datetime('now') WHERE user_id = ?1",
          )
          .bind(user.id, parsed.data.displayNumber)
          .run();
        return json({ ok: true });
      },
    },
  },
});
