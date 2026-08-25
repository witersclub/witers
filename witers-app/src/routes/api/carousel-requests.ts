import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getBrandProfile } from "../../lib/brand-profile.server";
import { notifyStaffNewCarouselRequest } from "../../lib/mail.server";
import { db, getMembership, getSessionUser, json } from "../../lib/witers-auth.server";

const createSchema = z.object({
  title: z.string().min(3).max(120),
  aspectRatio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).default("1:1"),
  slides: z
    .array(
      z.object({
        title: z.string().max(120).optional(),
        brief: z.string().min(5).max(2000),
      }),
    )
    .length(4),
});

export type CreateCarouselRequestInput = {
  title: string;
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  slides: { title?: string | null; brief: string }[]; // exactamente 4
};

// Extraída del mismo modo que createImageRequest en requests.ts, para que
// /api/calendar-entries-request pueda crear la solicitud real a partir de
// una entrada ya planificada por el mismo camino que el POST normal de
// abajo, sin duplicar el chequeo de cupo ni las columnas.
export async function createCarouselRequest(
  userId: string,
  userName: string,
  data: CreateCarouselRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const membership = await getMembership(userId);
  if (!membership || membership.status !== "active") {
    return { ok: false, error: "sin_membresia", status: 403 };
  }
  if (membership.carousel_requests_used >= membership.carousel_requests_quota) {
    return { ok: false, error: "sin_saldo", status: 403 };
  }

  const brand = await getBrandProfile(userId);
  if (!brand) return { ok: false, error: "falta_marca", status: 409 };

  const id = crypto.randomUUID();
  await db()
    .prepare(
      `INSERT INTO carousel_requests (id, user_id, title, aspect_ratio, company_name, brand_colors, logo_key)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      id,
      userId,
      data.title.trim(),
      data.aspectRatio,
      brand.company_name,
      brand.brand_colors,
      brand.logo_key,
    )
    .run();

  for (let i = 0; i < 4; i++) {
    const slide = data.slides[i];
    await db()
      .prepare(
        `INSERT INTO carousel_slides (id, carousel_request_id, slide_index, title, brief)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
      .bind(crypto.randomUUID(), id, i + 1, slide.title?.trim() || "", slide.brief.trim())
      .run();
  }

  await db()
    .prepare(
      "UPDATE memberships SET carousel_requests_used = carousel_requests_used + 1 WHERE user_id = ?1",
    )
    .bind(userId)
    .run();

  await notifyStaffNewCarouselRequest({
    title: data.title.trim(),
    clientName: userName,
    companyName: brand.company_name,
    panelUrl: "https://witers.com/witer",
  });

  return { ok: true, id };
}

export const Route = createFileRoute("/api/carousel-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare(
            `SELECT c.*,
               (SELECT json_group_array(json_object(
                  'id', s.id, 'slide_index', s.slide_index, 'title', s.title, 'brief', s.brief,
                  'delivered_key', s.delivered_key, 'delivered_at', s.delivered_at,
                  'change_request_note', s.change_request_note, 'change_requested_at', s.change_requested_at
                ))
                FROM carousel_slides s WHERE s.carousel_request_id = c.id ORDER BY s.slide_index) AS slides_json
             FROM carousel_requests c
             WHERE c.user_id = ?1
             ORDER BY c.created_at DESC`,
          )
          .bind(user.id)
          .all();

        return json({ ok: true, carouselRequests: rows.results ?? [] });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const result = await createCarouselRequest(user.id, user.name, parsed.data);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });
        return json({ ok: true, id: result.id });
      },
    },
  },
});
