import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { notifyStaffNewVideoRequest } from "../../lib/mail.server";
import { db, getMembership, getSessionUser, json } from "../../lib/witers-auth.server";

const createSchema = z.object({
  title: z.string().min(3).max(120),
  purpose: z.string().min(10).max(2000),
  platform: z.enum(["instagram", "tiktok", "youtube", "facebook", "otro"]),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  durationTarget: z.string().max(60).optional(),
  tone: z.string().max(200).optional(),
  musicMood: z.string().max(200).optional(),
  wantsAiScenes: z.boolean().default(false),
  aiScenesNote: z.string().max(1000).optional(),
  // Ya no exige al menos un archivo — un cliente puede no tener metraje
  // propio. Cuando viene vacío, wantsAiScenes+aiScenesNote es obligatorio
  // (validado más abajo) para que el equipo sepa qué resolver con stock/IA
  // en vez de recibir una solicitud sin ninguna instrucción de material.
  rawFileKeys: z.array(z.string().max(300)).max(10).default([]),
});

export type CreateVideoRequestInput = {
  title: string;
  purpose: string;
  platform: "instagram" | "tiktok" | "youtube" | "facebook" | "otro";
  aspectRatio: "9:16" | "1:1" | "16:9";
  durationTarget?: string | null;
  tone?: string | null;
  musicMood?: string | null;
  wantsAiScenes: boolean;
  aiScenesNote?: string | null;
  rawFileKeys: string[];
};

// Extraída del mismo modo que createImageRequest/createCarouselRequest,
// para que /api/calendar-entries-request pueda crear la solicitud real a
// partir de una entrada ya planificada por el mismo camino que el POST
// normal de abajo.
export async function createVideoRequest(
  userId: string,
  userName: string,
  data: CreateVideoRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const membership = await getMembership(userId);
  if (!membership || membership.status !== "active") {
    return { ok: false, error: "sin_membresia", status: 403 };
  }
  // Video spends from the same shared monthly pool as imagen/carrusel —
  // see createImageRequest in requests.ts and membership-plans.ts.
  if (membership.requests_used >= membership.requests_quota + membership.bonus_requests_quota) {
    return { ok: false, error: "sin_saldo", status: 403 };
  }
  if (data.rawFileKeys.length === 0 && !data.wantsAiScenes) {
    return { ok: false, error: "falta_metraje_o_ia", status: 400 };
  }
  if (data.wantsAiScenes && !data.aiScenesNote?.trim()) {
    return { ok: false, error: "faltan_escenas_ia", status: 400 };
  }

  // Every raw file key must actually belong to this user's own upload
  // prefix — otherwise a crafted request could attach someone else's
  // footage to a new video_requests row.
  const prefix = `video-raw/${userId}/`;
  if (data.rawFileKeys.some((k) => !k.startsWith(prefix))) {
    return { ok: false, error: "archivo_invalido", status: 400 };
  }

  const id = crypto.randomUUID();
  await db()
    .prepare(
      `INSERT INTO video_requests
         (id, user_id, title, purpose, platform, aspect_ratio, duration_target, tone, music_mood, wants_ai_scenes, ai_scenes_note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      id,
      userId,
      data.title.trim(),
      data.purpose.trim(),
      data.platform,
      data.aspectRatio,
      data.durationTarget?.trim() || null,
      data.tone?.trim() || null,
      data.musicMood?.trim() || null,
      data.wantsAiScenes ? 1 : 0,
      data.aiScenesNote?.trim() || null,
    )
    .run();

  for (const key of data.rawFileKeys) {
    const fileRow = await db()
      .prepare(
        "SELECT original_name, size_bytes FROM video_request_raw_files WHERE r2_key = ?1 AND video_request_id IS NULL",
      )
      .bind(key)
      .first<{ original_name: string; size_bytes: number }>();
    if (fileRow) {
      await db()
        .prepare("UPDATE video_request_raw_files SET video_request_id = ?2 WHERE r2_key = ?1")
        .bind(key, id)
        .run();
    }
  }

  await db()
    .prepare("UPDATE memberships SET requests_used = requests_used + 1 WHERE user_id = ?1")
    .bind(userId)
    .run();

  await notifyStaffNewVideoRequest({
    title: data.title.trim(),
    clientName: userName,
    companyName: userName,
    panelUrl: "https://witers.com/witer",
  });

  return { ok: true, id };
}

export const Route = createFileRoute("/api/video-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const rows = await db()
          .prepare(
            `SELECT v.*,
               (SELECT json_group_array(json_object('id', f.id, 'original_name', f.original_name, 'r2_key', f.r2_key))
                FROM video_request_raw_files f WHERE f.video_request_id = v.id) AS raw_files_json
             FROM video_requests v
             WHERE v.user_id = ?1
             ORDER BY v.created_at DESC`,
          )
          .bind(user.id)
          .all();

        return json({ ok: true, videoRequests: rows.results ?? [] });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const result = await createVideoRequest(user.id, user.name, parsed.data);
        if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });
        return json({ ok: true, id: result.id });
      },
    },
  },
});
