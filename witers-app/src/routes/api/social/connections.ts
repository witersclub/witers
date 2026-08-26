import { createFileRoute } from "@tanstack/react-router";

import { db, getSessionUser, json } from "../../../lib/witers-auth.server";

type ConnectionRow = { platform: "facebook" | "instagram"; external_name: string | null };

// Status for the Conexiones strip in Planificación — names only, never
// tokens. DELETE just removes WITERS's own copy of the connection; it does
// not call Meta to revoke the token on that end (v1 simplification, not
// forgotten — reconnecting always overwrites it anyway).
export const Route = createFileRoute("/api/social/connections")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare("SELECT platform, external_name FROM social_connections WHERE user_id = ?1")
          .bind(user.id)
          .all<ConnectionRow>();

        const byPlatform: Record<string, { name: string | null } | null> = {
          facebook: null,
          instagram: null,
        };
        for (const row of rows.results ?? []) {
          byPlatform[row.platform] = { name: row.external_name };
        }

        return json({ ok: true, connections: byPlatform });
      },

      DELETE: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const platform = new URL(request.url).searchParams.get("platform");
        if (platform !== "facebook" && platform !== "instagram") {
          return json({ ok: false, error: "plataforma_invalida" }, { status: 400 });
        }

        await db()
          .prepare("DELETE FROM social_connections WHERE user_id = ?1 AND platform = ?2")
          .bind(user.id, platform)
          .run();

        return json({ ok: true });
      },
    },
  },
});
