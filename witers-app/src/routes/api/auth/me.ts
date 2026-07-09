import { createFileRoute } from "@tanstack/react-router";

import { getMembership, getSessionUser, json } from "../../../lib/witers-auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false }, { status: 401 });
        const membership = await getMembership(user.id);
        return json({
          ok: true,
          user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
          membership,
        });
      },
    },
  },
});

