// Powers the live, back-and-forth conversation with "Wit" that a client has
// when creating a design request (panel.tsx's WitConversation) — a real
// multi-turn exchange with ChatGPT itself, not a scripted question list.
// The client always resends the full transcript; this call is otherwise
// stateless, same shape as polish-prompt.server.ts's OpenAI usage.

import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

export type WitBrandContext = {
  companyName: string;
  brandColors: string | null;
  businessType: string | null;
  hasLogo: boolean;
};

export type WitChatMessage = { role: "user" | "assistant"; content: string };

export type PieceDetails = {
  title: string;
  pieceType: string;
  pieceBrief: string;
  style: string;
  audience: string;
  ageRanges: string;
  aspectRatio: string;
  promoPrice: string;
  requiredText: string;
};

export type WitChatResult =
  | { ok: true; kind: "message"; text: string }
  | { ok: true; kind: "ask_aspect_ratio" }
  | { ok: true; kind: "done"; fields: PieceDetails }
  | { ok: false; error: string };

function buildSystemPrompt(brand: WitBrandContext): string {
  const brandLines = [
    `Nombre de la marca: ${brand.companyName}.`,
    brand.brandColors
      ? `Colores de marca ya definidos: ${brand.brandColors} (nunca preguntes por colores, ya están fijos).`
      : "La marca no tiene colores fijos todavía: puedes sugerir o elegir colores acordes al negocio si hace falta, sin preguntarle al cliente.",
    brand.businessType
      ? `Categoría de negocio: ${brand.businessType}.`
      : "No se especificó categoría de negocio.",
    brand.hasLogo
      ? "El cliente ya tiene un logotipo oficial registrado — no lo pidas ni preguntes por él."
      : "El cliente no tiene logotipo registrado — no lo pidas ni preguntes por él en esta conversación.",
  ];

  return (
    "Eres Wit, el director creativo de IA de WITERS, una agencia de branding por membresía. " +
    "Estás teniendo una conversación real, cálida y natural con un cliente para entender qué " +
    "pieza de diseño quiere crear hoy — no es un formulario, así que nunca hagas todas las " +
    "preguntas de golpe ni las enumeres: ve una idea a la vez, como lo haría un director de " +
    "arte humano en una llamada breve. Sé breve y conversacional en cada mensaje (1-3 frases).\n\n" +
    "En cuanto el cliente te diga por primera vez qué quiere crear (aunque sea en pocas " +
    "palabras), tu siguiente mensaje debe presentarle de una vez AL MENOS TRES propuestas " +
    "concretas y distintas entre sí para esa pieza — cada una con su propio ángulo o enfoque, " +
    "muy breves (una frase cada una) — usando el contexto de la marca y sus piezas anteriores " +
    "que ya tienes más abajo. Ciérralo preguntando cuál le gusta más o si prefiere algo distinto. " +
    "No sigas pidiendo más detalles sueltos antes de llegar a esta oferta de opciones.\n\n" +
    "Ya conoces estos datos de la marca del cliente, así que NUNCA los preguntes:\n" +
    brandLines.join("\n") +
    "\n\n" +
    "Tu trabajo es entender qué pieza quiere el cliente (tipo de pieza, qué debe mostrar/decir, " +
    "a quién le habla) y, cuando haga falta, decidir tú mismo con criterio profesional de " +
    "neuromarketing y diseño persuasivo el estilo visual, el público objetivo, el rango de " +
    "edad y el ángulo del copy — no se lo preguntes al cliente si no lo menciona, simplemente " +
    "decide lo que mejor convierta para ese tipo de negocio y pieza.\n\n" +
    "Reglas de seguridad, nunca las rompas:\n" +
    "- NUNCA inventes un precio, descuento o promoción. El campo promoPrice debe quedar como " +
    "cadena vacía a menos que el cliente haya mencionado explícitamente una cifra o descuento.\n" +
    "- Si el cliente SÍ escribió una cifra de precio o descuento en su mensaje — aunque venga " +
    "enterrada dentro de un texto largo, ya redactado, o mezclada con otros números (medidas en " +
    "píxeles, resolución, teléfonos) — cópiala en promoPrice carácter por carácter, exactamente " +
    "como aparece (mismos dígitos, misma moneda). No la redondees, no la reescribas, no la " +
    "confundas con ninguna otra cifra del mismo mensaje.\n" +
    "- NUNCA inventes un texto legal, dato obligatorio o frase que deba aparecer en la pieza. " +
    "El campo requiredText debe quedar como cadena vacía a menos que el cliente lo haya pedido " +
    "explícitamente.\n" +
    "- Nunca menciones limitaciones técnicas, que eres una IA, ni te disculpes por no poder " +
    "hacer algo — mantente siempre en el rol de director creativo.\n\n" +
    "Cuando sea el momento adecuado de preguntar el formato/proporción de la pieza (por ejemplo, " +
    "cuadrado, vertical para historias, horizontal para banner), NO anuncies primero que vas a " +
    "preguntarlo ni pidas permiso para continuar: llama directamente a la función " +
    "show_aspect_ratio_picker en ese mismo turno. La interfaz le mostrará al cliente opciones " +
    "visuales para elegir, y su elección aparecerá como su siguiente mensaje.\n\n" +
    "IMPORTANTE: SIEMPRE debes llamar a show_aspect_ratio_picker antes de submit_piece_details, " +
    "sin ninguna excepción — incluso si el cliente ya mencionó un formato, proporción o medida " +
    "concreta en su descripción de la pieza (por ejemplo '4:5', 'formato vertical', 'para " +
    "historias'). Nunca asumas el formato por tu cuenta ni lo tomes de lo que el cliente ya " +
    "escribió: siempre debe elegirlo él mismo en el selector visual antes de que puedas cerrar " +
    "la solicitud, aunque eso signifique preguntarlo de nuevo. Si el cliente ya lo mencionó, " +
    "puedes reconocerlo brevemente y aun así mostrarle el selector para que lo confirme ahí.\n\n" +
    "En cuanto tengas todo lo necesario — como mínimo qué debe mostrar la pieza y el formato ya " +
    "elegido por el cliente en el selector visual (nunca uno que tú hayas decidido) — llama " +
    "directamente a la función submit_piece_details con todos los campos completos en español, " +
    "en ese mismo turno. No sigas conversando después de eso.\n\n" +
    "Regla importante sobre estas dos funciones: NUNCA anuncies con texto que vas a mostrar el " +
    "formato o el resumen final, ni preguntes '¿quieres que continúe?', '¿te parece bien?' o " +
    "algo similar antes de llamarlas — eso obliga al cliente a decir 'sí, adelante' de más, y la " +
    "conversación se vuelve aburrida. El selector visual y la tarjeta de resumen que aparecen " +
    "después de la función SON el punto de confirmación; no necesitas pedir permiso antes."
  );
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "show_aspect_ratio_picker",
      description:
        "Llama a esto cuando sea momento de preguntar el formato/proporción de la pieza, en vez de preguntarlo con texto. Sin parámetros.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_piece_details",
      description:
        "Llama a esto solo cuando ya tengas toda la información necesaria para crear la solicitud de diseño, incluyendo el formato que el cliente ya eligió en el selector visual.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título corto para la pieza (máx. 8 palabras)." },
          pieceType: {
            type: "string",
            description: "Tipo de pieza, ej. 'Post para redes sociales', 'Banner', 'Flyer'.",
          },
          pieceBrief: {
            type: "string",
            description: "Descripción completa de lo que debe mostrar/decir la pieza.",
          },
          style: { type: "string", description: "Estilo visual sugerido para la pieza." },
          audience: { type: "string", description: "Público objetivo al que le habla la pieza." },
          ageRanges: {
            type: "string",
            description:
              "Rango(s) de edad del público, ej. '25-34, 35-44'. Cadena vacía si no aplica.",
          },
          aspectRatio: {
            type: "string",
            enum: ["1:1", "4:3", "3:4", "16:9", "9:16"],
            description: "El formato que el cliente eligió en el selector visual.",
          },
          promoPrice: {
            type: "string",
            description:
              "Precio o descuento EXACTO que el cliente mencionó, copiado carácter por carácter tal como lo escribió (mismos dígitos, misma moneda) — incluso si vino mezclado con otras cifras (medidas, resolución, teléfonos) dentro de un texto largo. Cadena vacía si no mencionó ninguno — nunca inventar ni redondear.",
          },
          requiredText: {
            type: "string",
            description:
              "Texto o dato que el cliente pidió explícitamente que apareciera en la pieza. Cadena vacía si no aplica — nunca inventar.",
          },
        },
        required: ["title", "pieceBrief", "aspectRatio"],
      },
    },
  },
];

type OpenAiToolCall = {
  function: { name: string; arguments: string };
};
type OpenAiMessage = { content?: string | null; tool_calls?: OpenAiToolCall[] };
type OpenAiChatResponse = { choices?: Array<{ message?: OpenAiMessage }> };

// tool_choice: "auto" means the model isn't actually forced to call
// show_aspect_ratio_picker just because the system prompt tells it to —
// in practice it sometimes writes the format question out as plain text
// instead (either listing the ratios, or just announcing "te muestro las
// opciones:" and stopping there with nothing after it). Either way the
// client is left staring at unclickable text with no picker, and has to
// type a guess to get unstuck. This catches both patterns after the fact
// and forces the real picker instead of trusting the model got it right.
// Kept in sync with the enum in /api/requests.ts and with ASPECT_OPTIONS in
// lab-pickers.tsx — these are the only formats the picker widget can ever
// produce, and the only ones the final POST accepts.
const VALID_ASPECT_RATIOS = new Set(["1:1", "4:3", "3:4", "16:9", "9:16"]);

function looksLikeAspectRatioAnnouncement(text: string): boolean {
  const t = text.toLowerCase();
  const mentionsFormat = /\bformato\b|proporci[oó]n/.test(t);
  if (!mentionsFormat) return false;
  const promisesOrLists =
    /(te muestro|aqu[ií] tienes|estas son las opciones|opciones:|qu[eé] formato)/.test(t);
  const mentionsRatios = /(1:1|4:3|3:4|16:9|9:16|cuadrado|vertical|horizontal)/.test(t);
  return promisesOrLists || mentionsRatios;
}

export async function runWitChat(
  history: WitChatMessage[],
  brand: WitBrandContext,
): Promise<WitChatResult> {
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
        temperature: 0.6,
        messages: [{ role: "system", content: buildSystemPrompt(brand) }, ...history],
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.info("[wit-chat] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  const body = (await response.json()) as OpenAiChatResponse;
  const message = body.choices?.[0]?.message;
  if (!message) return { ok: false, error: "sin_resultado" };

  const toolCall = message.tool_calls?.[0];
  if (toolCall?.function.name === "show_aspect_ratio_picker") {
    return { ok: true, kind: "ask_aspect_ratio" };
  }
  if (toolCall?.function.name === "submit_piece_details") {
    try {
      const args = JSON.parse(toolCall.function.arguments) as Partial<PieceDetails>;
      // The system prompt tells the model to always call
      // show_aspect_ratio_picker first, even if the client already mentioned
      // a format in their own words — but that's only an instruction, not an
      // enforced constraint (tool_choice is "auto"), and the model can still
      // decide it "already knows" the format from the client's description
      // and skip straight to submit_piece_details. This is the real
      // guarantee: only trust the format if the client actually clicked it
      // in the visual picker (recorded as this exact confirmation message by
      // panel.tsx's pickAspectRatio) — never a value the model typed itself,
      // valid-looking or not, and regardless of what the client wrote in the
      // piece's own description.
      const pickerWasUsed = history.some(
        (m) => m.role === "user" && m.content.startsWith("Elijo el formato:"),
      );
      if (
        !pickerWasUsed ||
        !args.aspectRatio ||
        !VALID_ASPECT_RATIOS.has(args.aspectRatio.trim())
      ) {
        return { ok: true, kind: "ask_aspect_ratio" };
      }
      return {
        ok: true,
        kind: "done",
        fields: {
          title: args.title?.trim() || "",
          pieceType: args.pieceType?.trim() || "",
          pieceBrief: args.pieceBrief?.trim() || "",
          style: args.style?.trim() || "",
          audience: args.audience?.trim() || "",
          ageRanges: args.ageRanges?.trim() || "",
          aspectRatio: args.aspectRatio.trim(),
          promoPrice: args.promoPrice?.trim() || "",
          requiredText: args.requiredText?.trim() || "",
        },
      };
    } catch {
      return { ok: false, error: "respuesta_invalida" };
    }
  }

  const text = message.content?.trim();
  if (!text) return { ok: false, error: "sin_resultado" };
  if (looksLikeAspectRatioAnnouncement(text)) {
    return { ok: true, kind: "ask_aspect_ratio" };
  }
  return { ok: true, kind: "message", text };
}
