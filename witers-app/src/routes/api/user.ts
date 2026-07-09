import { createFileRoute } from "@tanstack/react-router";

import { getSessionUser, json } from "../../lib/witers-auth.server";

// Returns the current session user (or 401). The admin panel uses this to
// decide whether to show the console — role must be 'admin'.
export const Route = createFileRoute("/api/user")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });
        return json({ ok: true, user });
      },
    },
  },
});
