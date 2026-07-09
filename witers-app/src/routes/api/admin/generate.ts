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

// Admin-only: generate the ad creative for a member request with OpenAI's
// GPT Image model. Requires the OPENAI_API_KEY secret (Runtime environment
// → Variables and secrets). Get a key at https://platform.openai.com/api-keys
const OPENAI_MODEL = "gpt-image-1";

// OpenAI only supports these three fixed sizes — map our aspect ratios to
// the closest one.
const SIZE_BY_RATIO: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "16:9": "1536x1024",
  "3:4": "1024x1536",
  "9:16": "1024x1536",
};

export const Route = createFileRoute("/api/admin/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json({ ok: false, error: "no_admin" }, { status: auth.status });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return json({ ok: false, error: "falta_openai_api_key" }, { status: 500 });
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
          response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: OPENAI_MODEL,
              prompt: parsed.data.prompt,
              size: SIZE_BY_RATIO[parsed.data.aspectRatio] ?? "1024x1024",
              n: 1,
            }),
          });
        } catch {
          return json({ ok: false, error: "tiempo_agotado" }, { status: 504 });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.info("[api/admin/generate] openai failed", response.status, detail.slice(0, 500));
          return json({ ok: false, error: "openai_error" }, { status: 502 });
        }

        type OpenAiResponse = { data?: Array<{ b64_json?: string }> };
        const body = (await response.json()) as OpenAiResponse;
        const images = body.data?.filter((d) => d.b64_json) ?? [];
        if (images.length === 0) {
          return json({ ok: false, error: "sin_resultado" }, { status: 502 });
        }

        // Store each image in R2 as a DRAFT — not shown to the client yet. An
        // admin must approve it (with the approval code) via
        // /api/admin/approve-result before it becomes visible in their panel.
        const keys: string[] = [];
        for (const img of images) {
          const bin = Uint8Array.from(atob(img.b64_json!), (ch) => ch.charCodeAt(0));
          const key = `generated/${parsed.data.requestId}/${crypto.randomUUID()}.png`;
          await STORAGE.put(key, bin.buffer as ArrayBuffer, {
            httpMetadata: { contentType: "image/png" },
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
