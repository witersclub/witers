import { createFileRoute } from "@tanstack/react-router";

import { getBrandProfile } from "../../../../lib/brand-profile.server";
import { getMetaAdOAuthAccessToken } from "../../../../lib/meta-ad-account-connection.server";
import { listMetaWhatsAppNumbers } from "../../../../lib/meta-whatsapp.server";
import { getSessionUser, json } from "../../../../lib/witers-auth.server";

// Lists the WhatsApp Business numbers the CURRENT session's own connected
// Meta login can see — never trusts anything from the client, same
// ad-account-scoped-to-session pattern as /api/campaigns-create.
export const Route = createFileRoute("/api/meta/whatsapp/numbers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const brandProfile = await getBrandProfile(user.id);
        const adAccountId = brandProfile?.meta_ad_account_id ?? null;
        if (!adAccountId) {
          return json({ ok: false, error: "cuenta_publicitaria_no_conectada" }, { status: 409 });
        }

        const oauthAccessToken = await getMetaAdOAuthAccessToken(user.id, adAccountId);
        if (!oauthAccessToken) {
          // Either never connected via the per-user OAuth flow (an admin
          // set meta_ad_account_id directly), or connected before
          // whatsapp_business_management was added to the scope list —
          // either way there's no token here that could carry it. The
          // client's own text tells them to reconnect rather than treating
          // this as "no numbers exist."
          return json({ ok: true, numbers: [], defaultNumber: null, needsReconnect: true });
        }

        const result = await listMetaWhatsAppNumbers(oauthAccessToken);
        if (!result.ok) {
          return json({ ok: false, error: result.error }, { status: 502 });
        }
        return json({
          ok: true,
          numbers: result.numbers,
          defaultNumber: brandProfile?.default_whatsapp_number ?? null,
          needsReconnect: false,
        });
      },
    },
  },
});
