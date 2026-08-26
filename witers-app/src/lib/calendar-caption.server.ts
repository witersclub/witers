// Suggested Instagram/social copy for a calendar entry — same one-shot
// OpenAI text-completion shape as polish-prompt.server.ts and
// brand-memory.server.ts, not a conversation: given the piece's already-
// written brief/guion/slides, write the caption ready to paste and post.

import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

export type GenerateCaptionInput = {
  companyName: string;
  businessType: string | null;
  brandMemory: string | null;
  format: "imagen" | "video" | "carrusel";
  title: string;
  brief: string;
  slides?: { title?: string | null; brief: string }[] | null;
};

function buildSystemPrompt(): string {
  return (
    "Eres Wit, el copywriter de WITERS, una agencia de branding por membresía. " +
    "Se te da el brief/guion ya definido de una pieza (imagen, video o carrusel) y tu trabajo es " +
    "escribir el copy listo para publicar en Instagram — el cliente lo va a copiar y pegar tal " +
    "cual, sin editarlo.\n\n" +
    "Estructura: una primera línea que funcione como gancho (detiene el scroll), 2-4 líneas de " +
    "cuerpo que desarrollen el mensaje de la pieza con un tono cercano y persuasivo, y un cierre " +
    "con llamado a la acción claro. Si tiene sentido para el negocio, termina con 3-6 hashtags " +
    "relevantes en su propia línea al final — nunca los inventes genéricos sin relación al " +
    "negocio o al contenido.\n\n" +
    "Reglas de seguridad, nunca las rompas:\n" +
    "- NUNCA inventes precios, descuentos, cifras o datos del negocio que no estén ya en el " +
    "brief que se te da.\n" +
    "- Nunca menciones que eres una IA ni te disculpes por limitaciones.\n\n" +
    "Responde ÚNICAMENTE con el copy final — sin comillas envolventes, sin explicación, sin " +
    "encabezados como 'Copy:' antes."
  );
}

function buildContentDescription(input: GenerateCaptionInput): string {
  if (input.format === "carrusel" && input.slides?.length) {
    const slideLines = input.slides
      .map((s, i) => `Lámina ${i + 1}${s.title ? ` (${s.title})` : ""}: ${s.brief}`)
      .join("\n");
    return `Carrusel "${input.title}":\n${slideLines}`;
  }
  const kind = input.format === "video" ? "Guion del video" : "Brief de la imagen";
  return `${kind} "${input.title}":\n${input.brief}`;
}

type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };

export async function generateCalendarCaption(
  input: GenerateCaptionInput,
): Promise<{ ok: true; caption: string } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const brandLines = [
    `Marca: ${input.companyName}.`,
    input.businessType ? `Categoría de negocio: ${input.businessType}.` : null,
    input.brandMemory
      ? `Aprendizajes previos sobre esta marca — mantén el mismo tono si aplica: ${input.brandMemory}`
      : null,
  ].filter((line): line is string => Boolean(line));

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
        temperature: 0.7,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: `${brandLines.join("\n")}\n\n${buildContentDescription(input)}`,
          },
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
    console.info("[calendar-caption] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  const body = (await response.json()) as OpenAiResponse;
  const caption = body.choices?.[0]?.message?.content?.trim();
  if (!caption) return { ok: false, error: "sin_resultado" };

  return { ok: true, caption };
}
