import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import process from "node:process";

import { bindings } from "../../../lib/bindings.server";
import { db, json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  requestId: z.string().uuid(),
  prompt: z.string().min(5).max(4000),
  aspectRatio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).default("1:1"),
});

// Admin-only: generate the ad creative for a member request with Google
// Gemini image generation. Requires the GEMINI_API_KEY secret:
//   npx wrangler secret put GEMINI_API_KEY
// Get a key at https://aistudio.google.com/apikey
const GEMINI_MODEL = "gemini-2.5-flash-image";

export const Route = createFileRoute("/api/admin/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_admin" }, { status: auth.status });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return json({ ok: false, error: "falta_gemini_api_key" }, { status: 500 });
        }

        const { STORAGE } = bindings();
        if (!STORAGE) return json({ ok: false, error: "sin_storage" }, { status: 500 });

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const reqRow = await db()
          .prepare("SELECT id FROM design_requests WHERE id = ?1")
          .bind(parsed.data.requestId)
          .first();
        if (!reqRow) return json({ ok: false, error: "solicitud_no_existe" }, { status: 404 });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120_000);
        let response: Response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
              method: "POST",
              signal: controller.signal,
              headers: {
                "content-type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: parsed.data.prompt }] }],
                generationConfig: {
                  responseModalities: ["IMAGE"],
                  imageConfig: { aspectRatio: parsed.data.aspectRatio },
                },
              }),
            },
          );
        } catch {
          return json({ ok: false, error: "tiempo_agotado" }, { status: 504 });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.info("[api/admin/generate] gemini failed", response.status, detail.slice(0, 500));
          return json({ ok: false, error: "gemini_error" }, { status: 502 });
        }

        type GeminiResponse = {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
          }>;
        };
        const body = (await response.json()) as GeminiResponse;
        const images =
          body.candidates?.flatMap(
            (c) => c.content?.parts?.filter((p) => p.inlineData?.data) ?? [],
          ) ?? [];
        if (images.length === 0) {
          return json({ ok: false, error: "sin_resultado" }, { status: 502 });
        }

        // Store each image in R2 as a DRAFT — not shown to the client yet. An
        // admin must approve it (with the approval code) via
        // /api/admin/approve-result before it becomes visible in their panel.
        const keys: string[] = [];
        for (const part of images) {
          const mime = part.inlineData!.mimeType ?? "image/png";
          const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
          const bin = Uint8Array.from(atob(part.inlineData!.data!), (ch) => ch.charCodeAt(0));
          const key = `generated/${parsed.data.requestId}/${crypto.randomUUID()}.${ext}`;
          await STORAGE.put(key, bin.buffer as ArrayBuffer, {
            httpMetadata: { contentType: mime },
          });
          keys.push(key);

          await db()
            .prepare(
              `INSERT INTO request_results (id, request_id, kind, r2_key)
               VALUES (?1, ?2, 'draft', ?3)`,
            )
            .bind(crypto.randomUUID(), parsed.data.requestId, key)
            .run();
        }

        return json({ ok: true, keys });
      },
    },
  },
});
