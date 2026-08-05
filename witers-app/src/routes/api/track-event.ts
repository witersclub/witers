import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";
import { readVisitorId, visitorCookie } from "../../lib/visitor.server";

const schema = z.object({
  type: z.enum(["whatsapp_click"]),
  path: z.string().max(300),
});

// Cloudflare populates `cf` on every request at the edge — see
// /api/visitor-heartbeat for the same cast/pattern.
type CfRequest = Request & { cf?: { country?: string } };

// Public, unauthenticated, fire-and-forget — logs a single click for the
// admin "Indicadores" tab (see site_events migration). Reuses the same
// anonymous wit_visitor cookie as the live-visitor heartbeat instead of
// minting a separate id, so a click and a heartbeat from the same browser
// are trivially the same visitor if that's ever useful later.
export const Route = createFileRoute("/api/track-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false }, { status: 400 });

        const existingId = readVisitorId(request);
        const visitorId = existingId ?? crypto.randomUUID();
        const user = await getSessionUser(request);
        const country = (request as CfRequest).cf?.country ?? null;

        await db()
          .prepare(
            `INSERT INTO site_events (id, type, path, visitor_id, user_id, country)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            crypto.randomUUID(),
            parsed.data.type,
            parsed.data.path,
            visitorId,
            user?.id ?? null,
            country,
          )
          .run();

        return json(
          { ok: true },
          existingId ? {} : { headers: { "set-cookie": visitorCookie(visitorId) } },
        );
      },
    },
  },
});
