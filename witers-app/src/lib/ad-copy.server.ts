// Generates the 3 ad-copy variants for the pauta wizard's "mensajes" step
// — same OpenAI account/pattern as polish-prompt.server.ts and
// wit-chat.server.ts, just a different, narrower prompt. Replaces the old
// "Me interesa X / Quiero saber más sobre X / Puedo apartar X" template,
// which wasn't real ad copy, just a title with a fixed prefix glued on.

import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

export type AdCopyInput = {
  title: string;
  pieceBrief: string | null;
  style: string | null;
  audience: string | null;
  companyName: string | null;
  objective: "trafico" | "interaccion" | "ventas";
};

const OBJECTIVE_BRIEFS: Record<AdCopyInput["objective"], string> = {
  trafico:
    "El objetivo es que la persona le dé clic para llegar a la Página, Instagram o sitio web — el copy debe generar curiosidad e invitar a entrar a ver más.",
  interaccion:
    "El objetivo es conseguir comentarios, likes y compartidos — el copy debe invitar a opinar, reaccionar o compartir, no solo a comprar.",
  ventas:
    "El objetivo es que la persona escriba por WhatsApp para comprar o apartar — el copy debe generar urgencia o deseo claro de contactar ahora.",
};

export type AdCopyResult =
  { ok: true; messages: [string, string, string] } | { ok: false; error: string };

export async function generateAdCopy(input: AdCopyInput): Promise<AdCopyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const brief = [
    `Marca: ${input.companyName ?? "sin especificar"}.`,
    `Pieza: ${input.title}.`,
    input.pieceBrief ? `Qué muestra/dice la pieza: ${input.pieceBrief}.` : null,
    input.style ? `Estilo visual: ${input.style}.` : null,
    input.audience ? `Público objetivo: ${input.audience}.` : null,
    OBJECTIVE_BRIEFS[input.objective],
  ]
    .filter(Boolean)
    .join(" ");

  const systemPrompt =
    "Eres un copywriter senior especializado en anuncios de Meta Ads (Facebook/Instagram). " +
    "Se te da el contexto de una pieza publicitaria ya diseñada y su objetivo de campaña. " +
    "Tu trabajo es escribir exactamente 3 variantes distintas de texto principal del anuncio " +
    "(el texto que acompaña la imagen, no un título ni una descripción aparte) — cada una con " +
    "un ángulo o gancho diferente entre sí, para que la campaña las pruebe una contra otra. " +
    "Reglas: en español, tono natural y persuasivo (no corporativo ni acartonado), máximo " +
    "150 caracteres cada una, sin hashtags, sin emojis excesivos (máximo uno si aporta), sin " +
    "comillas envolviendo el texto, y cada una debe terminar invitando a la acción concreta " +
    "que corresponde al objetivo de campaña que se te dio. Nunca inventes precios, " +
    "descuentos o datos que no estén en el contexto que se te dio. " +
    'Responde ÚNICAMENTE con un JSON válido de la forma {"messages": ["...", "...", "..."]}, ' +
    "sin explicación ni texto adicional.";

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
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: brief },
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
    console.info("[ad-copy] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };
  const body = (await response.json()) as OpenAiResponse;
  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) return { ok: false, error: "sin_resultado" };

  try {
    const parsed = JSON.parse(raw) as { messages?: unknown };
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      : [];
    if (messages.length < 1) return { ok: false, error: "respuesta_invalida" };
    // Pad up to 3 by repeating the last one, in the unlikely case the
    // model returns fewer than 3 — never fail the whole feature over it.
    while (messages.length < 3) messages.push(messages[messages.length - 1]);
    return { ok: true, messages: [messages[0], messages[1], messages[2]] };
  } catch {
    return { ok: false, error: "respuesta_invalida" };
  }
}
