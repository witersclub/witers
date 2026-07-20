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
  rawFileKeys: z.array(z.string().max(300)).min(1).max(10),
});

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

        const membership = await getMembership(user.id);
        if (!membership || membership.status !== "active") {
          return json({ ok: false, error: "sin_membresia" }, { status: 403 });
        }
        if (membership.video_requests_used >= membership.video_requests_quota) {
          return json({ ok: false, error: "sin_saldo" }, { status: 403 });
        }

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }
        const data = parsed.data;
        if (data.wantsAiScenes && !data.aiScenesNote?.trim()) {
          return json({ ok: false, error: "faltan_escenas_ia" }, { status: 400 });
        }

        // Every raw file key must actually belong to this user's own
        // upload prefix — otherwise a crafted request could attach someone
        // else's footage to a new video_requests row.
        const prefix = `video-raw/${user.id}/`;
        if (data.rawFileKeys.some((k) => !k.startsWith(prefix))) {
          return json({ ok: false, error: "archivo_invalido" }, { status: 400 });
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
            user.id,
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
          .prepare(
            "UPDATE memberships SET video_requests_used = video_requests_used + 1 WHERE user_id = ?1",
          )
          .bind(user.id)
          .run();

        await notifyStaffNewVideoRequest({
          title: data.title.trim(),
          clientName: user.name,
          companyName: user.name,
          panelUrl: "https://witers.com/witer",
        });

        return json({ ok: true, id });
      },
    },
  },
});
