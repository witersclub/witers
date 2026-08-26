import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { recordBrandSignal } from "../../lib/brand-memory.server";
import { notifyStaffCarouselChangeRequested } from "../../lib/mail.server";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  carouselRequestId: z.string().uuid(),
  // Omitted/null = "rehacer todo el carrusel" (applies the note to the 4
  // láminas at once). 1-4 = solo esa lámina puntual.
  slideIndex: z.number().int().min(1).max(4).nullable().optional(),
  message: z.string().min(5).max(1000),
});

// Client-only: flag a lámina (or the whole carousel) for revision. Unlike
// /api/request-change (plain images), there's no separate admin approval
// step to reopen it — the designer's panel already has an upload slot open
// for every lámina at all times, so simply re-delivering that slide
// (deliver-carousel-slide.ts) is what clears this note — the note just
// surfaces the ask in the meantime. What DOES need to happen here: if the
// request was already "completada" or "cerrada" (the client accepted it via
// /api/carousel-request-close), a new change request should knock it back
// to "en_proceso" so it reappears in staff's active queue instead of
// sitting silently inside "Finalizadas" — see staff-carousel-requests.tsx's
// filters, which now exclude both those terminal states from "mías".
export const Route = createFileRoute("/api/carousel-request-change")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const row = await db()
          .prepare("SELECT title, status FROM carousel_requests WHERE id = ?1 AND user_id = ?2")
          .bind(parsed.data.carouselRequestId, user.id)
          .first<{ title: string; status: string }>();
        if (!row) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });

        const message = parsed.data.message.trim();
        const slideIndex = parsed.data.slideIndex ?? null;

        if (slideIndex) {
          const result = await db()
            .prepare(
              `UPDATE carousel_slides
               SET change_request_note = ?3, change_requested_at = datetime('now')
               WHERE carousel_request_id = ?1 AND slide_index = ?2 AND delivered_key IS NOT NULL`,
            )
            .bind(parsed.data.carouselRequestId, slideIndex, message)
            .run();
          if (!result.meta.changes) {
            return json({ ok: false, error: "lamina_no_entregada" }, { status: 409 });
          }
        } else {
          await db()
            .prepare(
              `UPDATE carousel_slides
               SET change_request_note = ?2, change_requested_at = datetime('now')
               WHERE carousel_request_id = ?1 AND delivered_key IS NOT NULL`,
            )
            .bind(parsed.data.carouselRequestId, message)
            .run();
        }

        if (row.status === "completada" || row.status === "cerrada") {
          await db()
            .prepare(
              "UPDATE carousel_requests SET status = 'en_proceso', updated_at = datetime('now') WHERE id = ?1",
            )
            .bind(parsed.data.carouselRequestId)
            .run();
        }

        await notifyStaffCarouselChangeRequested({
          title: row.title,
          clientName: user.name,
          slideLabel: slideIndex ? `la lámina ${slideIndex}` : "las 4 láminas",
          message,
          panelUrl: "https://witers.com/witer",
        });

        await recordBrandSignal(
          user.id,
          `El cliente solicitó un cambio en ${
            slideIndex ? `la lámina ${slideIndex}` : "las 4 láminas"
          } del carrusel "${row.title}". Motivo: ${message}.`,
        );

        return json({ ok: true });
      },
    },
  },
});
