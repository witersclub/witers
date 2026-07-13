// Runs the locally-built prompt (design-prompt.server.ts) through a real
// ChatGPT text completion so what staff end up with reads like something a
// professional copywriter/art director wrote — spelling and grammar fixed,
// phrasing tightened — instead of the mechanically templated version. This
// is a text-only call (chat completions), not image generation: we stopped
// asking OpenAI to generate the actual creative because the results weren't
// good enough to ship, but the same account/API key is still useful here.

import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "Eres un director de arte y copywriter senior de una agencia de branding premium. " +
  "Se te da un brief de una pieza publicitaria, escrito de forma mecánica o con posibles " +
  "errores de ortografía/redacción. Reescríbelo como un prompt profesional, claro y bien " +
  "redactado en español, listo para entregarle a un diseñador o a una herramienta de " +
  "generación de imágenes. Corrige ortografía y gramática, mejora la redacción y el flujo, " +
  "pero NUNCA inventes ni elimines información: cualquier nombre propio, color, cifra, " +
  "precio, texto entre comillas o dato exacto debe conservarse tal cual. No agregues " +
  "comentarios, explicaciones ni encabezados — responde únicamente con el prompt final.";

export type PolishPromptResult = { ok: true; prompt: string } | { ok: false; error: string };

export async function polishPromptWithAI(rawPrompt: string): Promise<PolishPromptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
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
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawPrompt },
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
    console.info("[polish-prompt] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };
  const body = (await response.json()) as OpenAiResponse;
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "sin_resultado" };

  return { ok: true, prompt: text };
}
