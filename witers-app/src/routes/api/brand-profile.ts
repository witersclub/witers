import { createFileRoute } from "@tanstack/react-router";

import { getBrandProfile } from "../../lib/brand-profile.server";
import { getSessionUser, json } from "../../lib/witers-auth.server";

export const Route = createFileRoute("/api/brand-profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        const profile = await getBrandProfile(user.id);
        return json({ ok: true, profile });
      },
    },
  },
});
