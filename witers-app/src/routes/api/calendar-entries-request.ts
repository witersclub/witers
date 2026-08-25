import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../lib/brand-profile.server";
import { createImageRequest } from "./requests";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

type EntryRow = {
  id: string;
  format: "imagen" | "video" | "carrusel";
  title: string;
  brief: string;
  request_id: string | null;
};

const REQUEST_TABLE: Record<"video" | "carrusel", string> = {
  video: "video_requests",
  carrusel: "carousel_requests",
};

// Two shapes: { entryId } turns an "imagen" entry straight into a real
// request (only format that only needs text — see the 0040 migration
// comment and the calendar_entries.request_id note). { entryId,
// linkRequestId } instead just links a calendar entry to a video/carrusel
// request the client already created by hand through those flows' own
// wizard — video needs an uploaded file and carrusel needs 4 real slides,
// neither of which a one-line calendar brief can safely fabricate, so those
// two formats pre-fill the existing wizard client-side instead of an
// instant one-click create.
const schema = z.object({
  entryId: z.string().uuid(),
  linkRequestId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/calendar-entries-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });

        const entry = await db()
          .prepare(
            "SELECT id, format, title, brief, request_id FROM calendar_entries WHERE id = ?1 AND user_id = ?2",
          )
          .bind(parsed.data.entryId, user.id)
          .first<EntryRow>();
        if (!entry) return json({ ok: false, error: "no_encontrada" }, { status: 404 });
        if (entry.request_id) return json({ ok: false, error: "ya_pedida" }, { status: 409 });

        if (parsed.data.linkRequestId) {
          if (entry.format !== "video" && entry.format !== "carrusel") {
            return json({ ok: false, error: "formato_invalido" }, { status: 400 });
          }
          const owned = await db()
            .prepare(`SELECT id FROM ${REQUEST_TABLE[entry.format]} WHERE id = ?1 AND user_id = ?2`)
            .bind(parsed.data.linkRequestId, user.id)
            .first<{ id: string }>();
          if (!owned) return json({ ok: false, error: "solicitud_invalida" }, { status: 404 });

          await db()
            .prepare(
              "UPDATE calendar_entries SET request_id = ?2 WHERE id = ?1 AND request_id IS NULL",
            )
            .bind(entry.id, parsed.data.linkRequestId)
            .run();
          return json({ ok: true, requestId: parsed.data.linkRequestId });
        }

        if (entry.format !== "imagen") {
          return json({ ok: false, error: "formato_invalido" }, { status: 400 });
        }

        const brand = await getBrandProfile(user.id);
        if (!brand) return json({ ok: false, error: "falta_marca" }, { status: 409 });

        const result = await createImageRequest(user.id, user.name, {
          title: entry.title,
          companyName: brand.company_name,
          pieceBrief: entry.brief,
          aspectRatio: "1:1",
          lang: "es",
          brandColors: brand.brand_colors,
          businessType: brand.business_type,
          logoKey: brand.logo_key,
          noLogo: !brand.logo_key,
        });
        if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });

        await db()
          .prepare(
            "UPDATE calendar_entries SET request_id = ?2 WHERE id = ?1 AND request_id IS NULL",
          )
          .bind(entry.id, result.id)
          .run();

        return json({ ok: true, requestId: result.id });
      },
    },
  },
});
