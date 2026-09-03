import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getSessionUser, json } from "../../lib/witers-auth.server";

const saveSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  ageMin: z.number().int().min(13).max(65),
  ageMax: z.number().int().min(13).max(65),
  locationKey: z.string().min(1).max(200).nullable().optional(),
  locationLabel: z.string().min(1).max(200).nullable().optional(),
  radiusKm: z.number().min(5).max(50).nullable().optional(),
  interests: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).max(10),
  notes: z.string().max(500).nullable().optional(),
});

type SavedAudienceRow = {
  id: string;
  name: string;
  description: string;
  age_min: number;
  age_max: number;
  location_key: string | null;
  location_label: string | null;
  radius_km: number | null;
  interests_json: string;
  notes: string | null;
  created_at: string;
};

// Reusable audiences for "Pautar" — see migrations/0055_saved_audiences.sql.
// Everything stored here was already resolved against Meta's real search
// when first created (see meta-audience-suggest.ts); reusing one never
// re-runs the AI interpretation or the Meta search, it's a straight
// apply of already-verified fields.
export const Route = createFileRoute("/api/meta-audience-saved")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare(
            `SELECT id, name, description, age_min, age_max, location_key, location_label,
                    radius_km, interests_json, notes, created_at
             FROM saved_audiences WHERE user_id = ?1 ORDER BY created_at DESC`,
          )
          .bind(user.id)
          .all<SavedAudienceRow>();

        const audiences = (rows.results ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          ageMin: row.age_min,
          ageMax: row.age_max,
          locationKey: row.location_key,
          locationLabel: row.location_label,
          radiusKm: row.radius_km,
          interests: JSON.parse(row.interests_json) as { id: string; name: string }[],
          notes: row.notes,
          createdAt: row.created_at,
        }));
        return json({ ok: true, audiences });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = saveSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        const data = parsed.data;

        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO saved_audiences
               (id, user_id, name, description, age_min, age_max, location_key, location_label,
                radius_km, interests_json, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
          )
          .bind(
            id,
            user.id,
            data.name,
            data.description,
            data.ageMin,
            data.ageMax,
            data.locationKey ?? null,
            data.locationLabel ?? null,
            data.radiusKm ?? null,
            JSON.stringify(data.interests),
            data.notes ?? null,
          )
          .run();

        return json({ ok: true, id });
      },

      DELETE: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const id = new URL(request.url).searchParams.get("id");
        if (!id) return json({ ok: false, error: "falta_id" }, { status: 400 });

        await db()
          .prepare("DELETE FROM saved_audiences WHERE id = ?1 AND user_id = ?2")
          .bind(id, user.id)
          .run();

        return json({ ok: true });
      },
    },
  },
});
