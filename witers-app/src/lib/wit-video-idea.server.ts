// Turns a client's freeform (typed or dictated) description of a video idea
// into a short title + a clear purpose statement — the video wizard's first
// step, so a loose spoken idea gets real structure before the client moves
// on to picking platform/tone/etc. One-shot completion, same pattern as
// polish-prompt.server.ts — not a multi-turn tool-calling conversation like
// wit-chat.server.ts, since this only needs to happen once per request.
import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "Eres Wit, el director creativo de IA de WITERS, una agencia de branding por membresía. " +
  "Un cliente te acaba de describir, con sus propias palabras — a veces por voz, así que " +
  "puede venir con muletillas, ideas sueltas o mal puntuado — qué video quiere crear. Tu " +
  "trabajo es darle estructura: un título corto (máximo 8 palabras) y un propósito claro en " +
  "1-3 frases que explique qué debe lograr el video y qué debe mostrar o decir. Corrige " +
  "ortografía y limpia muletillas conversacionales, pero NUNCA inventes datos que el cliente " +
  "no dio — nombres, cifras, precios o promesas no mencionadas. Si la idea es vaga, el " +
  "propósito puede quedarse igual de general; eso está bien, no rellenes con suposiciones. " +
  "Si el cliente sí menciona una cifra exacta (precio, descuento, fecha, duración), cópiala " +
  "tal cual, sin cambiar un solo dígito. " +
  'Responde ÚNICAMENTE con un JSON de este formato exacto, sin texto adicional: {"title": "...", "purpose": "..."}.';

export type VideoIdeaResult =
  { ok: true; title: string; purpose: string } | { ok: false; error: string };

export async function interpretVideoIdea(rawText: string): Promise<VideoIdeaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

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
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawText },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.info("[wit-video-idea] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };
  const body = (await response.json()) as OpenAiResponse;
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "sin_resultado" };

  try {
    const parsed = JSON.parse(text) as { title?: string; purpose?: string };
    const title = parsed.title?.trim();
    const purpose = parsed.purpose?.trim();
    if (!title || !purpose) return { ok: false, error: "respuesta_invalida" };
    return { ok: true, title, purpose };
  } catch {
    return { ok: false, error: "respuesta_invalida" };
  }
}
