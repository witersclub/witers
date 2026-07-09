import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { db, getMembership, getSessionUser, json } from "../../lib/witers-auth.server";

const createSchema = z.object({
  title: z.string().min(3).max(120),
  brief: z.string().min(10).max(4000),
  style: z.string().max(200).optional(),
  aspectRatio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).default("1:1"),
  referenceKey: z.string().max(300).optional(),
  audience: z.string().max(200).optional(),
  ageRange: z.string().max(40).optional(),
  requiredText: z.string().max(500).optional(),
  brandColors: z.string().max(60).optional(),
});

export const Route = createFileRoute("/api/requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare(
            `SELECT r.*,
               (SELECT json_group_array(json_object('id', res.id, 'kind', res.kind, 'image_url', res.image_url, 'r2_key', res.r2_key))
                FROM request_results res WHERE res.request_id = r.id) AS results_json
             FROM design_requests r
             WHERE r.user_id = ?1
             ORDER BY r.created_at DESC`,
          )
          .bind(user.id)
          .all();

        return json({ ok: true, requests: rows.results ?? [] });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const membership = await getMembership(user.id);
        if (!membership || membership.status !== "active") {
          return json({ ok: false, error: "sin_membresia" }, { status: 403 });
        }
        if (membership.requests_used >= membership.requests_quota) {
          return json({ ok: false, error: "sin_saldo" }, { status: 403 });
        }

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const id = crypto.randomUUID();
        await db()
          .prepare(
            `INSERT INTO design_requests
               (id, user_id, title, brief, style, aspect_ratio, reference_key, audience, age_range, required_text, brand_colors)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
          )
          .bind(
            id,
            user.id,
            parsed.data.title.trim(),
            parsed.data.brief.trim(),
            parsed.data.style?.trim() ?? null,
            parsed.data.aspectRatio,
            parsed.data.referenceKey ?? null,
            parsed.data.audience?.trim() ?? null,
            parsed.data.ageRange ?? null,
            parsed.data.requiredText?.trim() ?? null,
            parsed.data.brandColors ?? null,
          )
          .run();

        await db()
          .prepare("UPDATE memberships SET requests_used = requests_used + 1 WHERE user_id = ?1")
          .bind(user.id)
          .run();

        return json({ ok: true, id });
      },
    },
  },
});

