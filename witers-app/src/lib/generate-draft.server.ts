// Calls OpenAI's image model for a design request and stores the result(s)
// in R2 as draft request_results rows — never sent to the client until an
// admin approves them via /api/admin/approve-result. Shared by the
// automatic generation triggered right after a client submits a request
// and by the manual "Generar con IA" / "Regenerar" button in the staff
// panels.

import process from "node:process";

import { bindings } from "./bindings.server";
import { db } from "./witers-auth.server";

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

export type GenerateDraftResult = { ok: true; keys: string[] } | { ok: false; error: string };

export async function generateDraftForRequest(
  requestId: string,
  prompt: string,
  aspectRatio: string,
): Promise<GenerateDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const { STORAGE } = bindings();
  if (!STORAGE) return { ok: false, error: "sin_storage" };

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
        prompt,
        size: SIZE_BY_RATIO[aspectRatio] ?? "1024x1024",
        n: 1,
      }),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.info("[generate-draft] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  type OpenAiResponse = { data?: Array<{ b64_json?: string }> };
  const body = (await response.json()) as OpenAiResponse;
  const images = body.data?.filter((d) => d.b64_json) ?? [];
  if (images.length === 0) return { ok: false, error: "sin_resultado" };

  const keys: string[] = [];
  for (const img of images) {
    const bin = Uint8Array.from(atob(img.b64_json!), (ch) => ch.charCodeAt(0));
    const key = `generated/${requestId}/${crypto.randomUUID()}.png`;
    await STORAGE.put(key, bin.buffer as ArrayBuffer, {
      httpMetadata: { contentType: "image/png" },
    });
    keys.push(key);

    await db()
      .prepare(
        `INSERT INTO request_results (id, request_id, kind, r2_key)
         VALUES (?1, ?2, 'draft', ?3)`,
      )
      .bind(crypto.randomUUID(), requestId, key)
      .run();
  }

  return { ok: true, keys };
}
