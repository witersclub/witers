import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getImagePack, isImagePackId } from "../../lib/image-packs";
import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  cardName: z.string().min(2).max(80),
  cardLast4: z.string().regex(/^\d{4}$/),
  packId: z.string().refine(isImagePackId),
});

// One-time add-on purchase: unlike /api/checkout (which activates or renews
// a membership), this only makes sense on top of an already-active
// membership — a pack tops up solicitudes, it doesn't grant them on its
// own. Same sandbox payment pattern as checkout: card fields accepted for
// UX completeness but NEVER stored, payment always "succeeds" until a real
// gateway is wired in.
export const Route = createFileRoute("/api/purchase-pack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const pack = getImagePack(parsed.data.packId);

        const membership = await db()
          .prepare("SELECT id, status FROM memberships WHERE user_id = ?1")
          .bind(user.id)
          .first<{ id: string; status: string }>();
        if (!membership || membership.status !== "active") {
          return json({ ok: false, error: "sin_membresia" }, { status: 403 });
        }

        await db()
          .prepare(
            "UPDATE memberships SET bonus_requests_quota = bonus_requests_quota + ?2 WHERE id = ?1",
          )
          .bind(membership.id, pack.images)
          .run();

        const paymentId = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO payments (id, user_id, membership_id, amount_mxn, method, provider, provider_ref, status, pack_id, pack_images)
             VALUES (?1, ?2, ?3, ?4, 'card', 'sandbox', ?5, 'paid', ?6, ?7)`,
          )
          .bind(
            paymentId,
            user.id,
            membership.id,
            pack.precioPromo,
            `card-${parsed.data.cardLast4}`,
            pack.id,
            pack.images,
          )
          .run();

        return json({ ok: true, paymentId, bonusAdded: pack.images });
      },
    },
  },
});
