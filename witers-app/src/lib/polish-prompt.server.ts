// Runs the locally-built prompt (design-prompt.server.ts) through a real
// ChatGPT text completion so what staff end up with reads like something a
// professional copywriter/art director wrote — spelling and grammar fixed,
// phrasing tightened — instead of the mechanically templated version. This
// is a text-only call (chat completions), not image generation: we stopped
// asking OpenAI to generate the actual creative because the results weren't
// good enough to ship, but the same account/API key is still useful here.

import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

// Both versions are otherwise identical, word for word — only the output
// language directive changes. Kept as one shared body instead of two
// separately-maintained strings so future edits can't drift between them
// (see the bug this fixed: the Spanish version alone used to run
// unconditionally on English requests, handing designers a Spanish prompt —
// and therefore a Spanish-copy final piece — for a client who asked in
// English).
function buildSystemPrompt(lang: "es" | "en"): string {
  const outputLanguageLine =
    lang === "en"
      ? "Your only output is the final prompt in English, "
      : "Tu única salida es el prompt final en español, ";
  return (
    "Eres un director de arte y copywriter senior de una agencia de branding premium. " +
    "Se te da un brief de una pieza publicitaria, escrito de forma mecánica o con posibles " +
    "errores de ortografía/redacción, incluyendo respuestas de cliente pegadas tal cual las " +
    "escribieron (a veces coloquiales, con muletillas o afirmaciones sueltas). " +
    outputLanguageLine +
    "listo para que un diseñador lo pegue TAL CUAL en otra IA " +
    "generadora de imágenes (Midjourney, DALL·E, etc.) y obtenga un resultado exacto desde el " +
    "primer intento — nunca lo lee un humano como brief, así que debe bastarse a sí mismo. " +
    "Corrige ortografía y gramática, mejora la redacción y el flujo. " +
    "Las respuestas del cliente pueden venir escritas de forma coloquial (ej. la respuesta " +
    "'sí, de 12,000 a 5,999' a la pregunta de si hay un descuento a destacar): extrae " +
    "únicamente el dato útil (aquí, el descuento de $12,000 a $5,999) y descarta las " +
    "muletillas conversacionales ('sí,', 'no,', 'pues', 'este', 'o sea', etc.) — pero NUNCA " +
    "inventes ni elimines un dato real: cualquier nombre propio, color, cifra, precio o " +
    "instrucción concreta del cliente debe conservarse sin alterar su significado. " +
    "Trato especial para cifras (precios, descuentos, teléfonos, medidas en píxeles, " +
    "resolución, etc.): cópialas siempre carácter por carácter, exactamente como aparecen en " +
    "el brief — nunca las redondees, nunca cambies un solo dígito, y nunca confundas una cifra " +
    "con otra aunque el brief traiga varias juntas o mezcladas (por ejemplo, no confundas un " +
    "precio con una medida de píxeles o con un número de teléfono). Si el brief NO menciona " +
    "ningún precio o promoción, la pieza final tampoco debe mencionar ninguno — nunca agregues " +
    "un precio que no esté explícitamente en el brief, bajo ninguna circunstancia. Si el " +
    "cliente pide explícitamente que una frase aparezca tal cual en la pieza (por ejemplo, " +
    "entre comillas o diciendo 'debe decir exactamente...'), esa frase sí se conserva literal, " +
    "palabra por palabra, aunque el resto de su respuesta sí se limpie. " +
    "Describe con el nivel de detalle que una IA de imágenes necesita para acertar a la " +
    "primera: composición, encuadre, iluminación, paleta de colores exacta, estilo " +
    "tipográfico, y el texto obligatorio del cliente como copy literal que debe aparecer " +
    "sobreimpreso en la pieza. " +
    "Si el brief menciona que el cliente ya tiene logotipo oficial y/o una foto de referencia " +
    "del producto, agrega dos cosas, sin contradecirse entre sí y sin mencionar nunca ninguna " +
    "limitación técnica ni disculparte por no poder insertar el logo: (1) al final del prompt, " +
    "separada del resto, una nota corta para el diseñador diciéndole que descargue esos " +
    "archivos desde el panel y los suba a su herramienta de generación de imágenes junto con " +
    "este prompt; (2) dentro del prompt mismo, una descripción normal de dirección de arte del " +
    "tratamiento visual esperado (tipografía y colores acordes a una marca ya establecida, " +
    "composición del producto), como una instrucción de estilo más, no como una alternativa " +
    "por si la nota (1) no funciona. " +
    "No agregues comentarios, explicaciones ni encabezados — responde únicamente con el " +
    "prompt final."
  );
}

export type PolishPromptResult = { ok: true; prompt: string } | { ok: false; error: string };

export async function polishPromptWithAI(
  rawPrompt: string,
  lang: "es" | "en" = "es",
): Promise<PolishPromptResult> {
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
          { role: "system", content: buildSystemPrompt(lang) },
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
