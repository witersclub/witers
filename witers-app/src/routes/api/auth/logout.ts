import { createFileRoute } from "@tanstack/react-router";

import {
  clearSessionCookie,
  destroySession,
  json,
  readSessionToken,
} from "../../../lib/witers-auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = readSessionToken(request);
        if (token) await destroySession(token);
        return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
      },
    },
  },
});

