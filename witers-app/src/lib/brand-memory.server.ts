// "Memoria inferida": a compact, evolving note per brand that Wit builds up
// on its own from real signals (a design rejected by staff, a change the
// client requested) — never asked directly. Same OpenAI text-completion
// shape as polish-prompt.server.ts (best-effort, never blocks the caller),
// but instead of a one-shot transform, each call merges a new signal into
// whatever notes already exist so the memory stays a bounded, current
// summary rather than an ever-growing log.

import process from "node:process";

import { db } from "./witers-auth.server";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";
const MAX_NOTES_CHARS = 1500;

export async function getBrandMemory(userId: string): Promise<string | null> {
  const row = await db()
    .prepare("SELECT notes FROM brand_memory WHERE user_id = ?1")
    .bind(userId)
    .first<{ notes: string }>();
  const notes = row?.notes?.trim();
  return notes ? notes : null;
}

function buildMergeSystemPrompt(): string {
  return (
    "Mantienes una memoria breve e interna sobre las preferencias de una marca cliente, " +
    "inferida de señales reales (piezas rechazadas, cambios solicitados) — nunca preguntada " +
    "directamente. Se te da la memoria actual (puede estar vacía) y una nueva señal. Devuelve " +
    "la memoria ACTUALIZADA completa: fusiona la nueva señal con la existente, resume en puntos " +
    "breves y accionables, elimina puntos que la nueva señal contradiga o ya no apliquen, y no " +
    "repitas puntos equivalentes. Máximo 8-10 puntos, cada uno de una línea. Nunca inventes " +
    "preferencias que no se desprendan de una señal real. Responde ÚNICAMENTE con la lista " +
    "actualizada (una viñeta '- ' por línea), o una cadena vacía si no hay nada que anotar — sin " +
    "explicaciones ni encabezados."
  );
}

type OpenAiChatResponse = { choices?: Array<{ message?: { content?: string } }> };

// Best-effort, non-blocking: any failure (missing key, network, bad
// response) is swallowed so the caller's own action — a rejection, a
// change request — never fails because this side-effect did.
export async function recordBrandSignal(userId: string, signal: string): Promise<void> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;
    const existing = (await getBrandMemory(userId)) ?? "";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_TEXT_MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: buildMergeSystemPrompt() },
            {
              role: "user",
              content: `NOTAS ACTUALES:\n${existing || "(vacío)"}\n\nNUEVA SEÑAL:\n${signal}`,
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.info("[brand-memory] openai failed", response.status, detail.slice(0, 500));
      return;
    }

    const body = (await response.json()) as OpenAiChatResponse;
    const merged = body.choices?.[0]?.message?.content?.trim();
    if (merged === undefined) return;
    const capped = merged.slice(0, MAX_NOTES_CHARS);

    await db()
      .prepare(
        `INSERT INTO brand_memory (user_id, notes, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET notes = excluded.notes, updated_at = datetime('now')`,
      )
      .bind(userId, capped)
      .run();
  } catch (err) {
    console.info("[brand-memory] recordBrandSignal threw", err);
  }
}
