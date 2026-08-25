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

export type CarouselSlideDraft = { title: string; brief: string };

export type CarouselDetails = {
  title: string;
  aspectRatio: string;
  slides: CarouselSlideDraft[]; // siempre 4, en orden (lámina 1-4)
};

export type WitCarouselChatResult =
  | { ok: true; kind: "message"; text: string }
  | { ok: true; kind: "ask_aspect_ratio" }
  | { ok: true; kind: "done"; details: CarouselDetails }
  | { ok: false; error: string };

export type CalendarFormat = "imagen" | "video" | "carrusel";
export type CalendarEntryDraft = {
  date: string; // YYYY-MM-DD
  format: CalendarFormat;
  title: string;
  brief: string;
};

export type WitCalendarChatResult =
  | { ok: true; kind: "message"; text: string }
  | { ok: true; kind: "done"; entries: CalendarEntryDraft[] }
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
    "Idioma: responde siempre en el mismo idioma en el que te escribe el cliente. Si escribe en " +
    "inglés, conversa en inglés y redacta también en inglés los campos de submit_piece_details " +
    "(pieceBrief, style, audience, requiredText, etc.); si escribe en español, todo en español. " +
    "Si cambia de idioma a mitad de la conversación, sigue tú el idioma de su último mensaje.\n\n" +
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
    "Hay dos preguntas concretas que SIEMPRE debes hacer en algún momento de la conversación " +
    "(en su propio turno cada una, no juntas ni de golpe — normalmente fluyen bien justo " +
    "después de que el cliente elige uno de los conceptos iniciales), a menos que el cliente ya " +
    "haya respondido esto por su cuenta antes de que llegues a preguntarlo:\n" +
    "1. Si la pieza debe mostrar un precio, descuento o promoción, y de cuánto. Esto SÍ hay que " +
    "preguntarlo activamente — no te quedes esperando a que el cliente lo mencione solo. Captura " +
    "la cifra únicamente si el cliente te la da explícitamente en su respuesta; si dice que no " +
    "lleva precio, deja promoPrice vacío (ver regla de seguridad más abajo: nunca inventes uno).\n" +
    "2. Si el cliente tiene fotos de referencia del producto para adjuntar. Menciónale que puede " +
    "subirlas con el botón de clip (📎) junto al mensaje. Si ya adjuntó una o más fotos antes en " +
    "la conversación, no se lo vuelvas a preguntar.\n" +
    "No llames a submit_piece_details sin haber hecho estas dos preguntas al menos una vez cada " +
    "una, aunque el cliente responda que no a alguna.\n\n" +
    "Si el cliente, en vez de conversar contigo, pega directamente un prompt ya completamente " +
    "redactado (por ejemplo, uno escrito para pegarse en una IA de imágenes, con secciones " +
    "como marca, precio, formato, teléfonos, estilo/referencias, todo junto en uno o varios " +
    "párrafos), tu trabajo es LEERLO COMPLETO y repartir cada dato en su campo correspondiente " +
    "de submit_piece_details — nunca copies el bloque entero sin organizar dentro de un solo " +
    "campo. En particular: cualquier precio, descuento o promoción va a promoPrice (nunca se " +
    "queda solo mencionado dentro de pieceBrief); cualquier teléfono, texto legal o frase que " +
    "deba aparecer tal cual va a requiredText; el resto de la descripción visual/creativa va a " +
    "pieceBrief y style. Sigue mostrando el selector de formato igual que siempre, aunque el " +
    "prompt ya traiga una medida o proporción — nunca la tomes de ahí directamente.\n\n" +
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
    "directamente a la función submit_piece_details con todos los campos completos (en el idioma " +
    "de la conversación, ver arriba), en ese mismo turno. No sigas conversando después de eso.\n\n" +
    "Regla importante sobre estas dos funciones: NUNCA anuncies con texto que vas a mostrar el " +
    "formato o el resumen final, ni preguntes '¿quieres que continúe?', '¿te parece bien?' o " +
    "algo similar antes de llamarlas — eso obliga al cliente a decir 'sí, adelante' de más, y la " +
    "conversación se vuelve aburrida. El selector visual y la tarjeta de resumen que aparecen " +
    "después de la función SON el punto de confirmación; no necesitas pedir permiso antes."
  );
}

function buildCarouselSystemPrompt(brand: WitBrandContext): string {
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
    "Estás ayudando a un cliente a crear un CARRUSEL de exactamente 4 láminas para redes " +
    "sociales (Instagram/Facebook) — una secuencia ordenada de 4 imágenes que se deslizan una " +
    "tras otra, no 4 piezas sueltas. Es una conversación real, cálida y natural, no un " +
    "formulario: ve una idea a la vez y sé breve (1-3 frases por turno).\n\n" +
    "Idioma: responde siempre en el mismo idioma en el que te escribe el cliente. Si escribe en " +
    "inglés, conversa en inglés y redacta también en inglés los títulos y briefs de las láminas " +
    "en submit_carousel_details; si escribe en español, todo en español. Si cambia de idioma a " +
    "mitad de la conversación, sigue tú el idioma de su último mensaje.\n\n" +
    "En cuanto el cliente te diga por primera vez de qué quiere el carrusel (aunque sea en " +
    "pocas palabras), tu siguiente mensaje debe presentarle AL MENOS TRES conceptos de carrusel " +
    "distintos entre sí (cada uno con su propio ángulo/narrativa de 4 láminas), muy breves " +
    "(una frase cada uno), usando el contexto de la marca. Ciérralo preguntando cuál le gusta " +
    "más o si prefiere algo distinto.\n\n" +
    "Ya conoces estos datos de la marca del cliente, así que NUNCA los preguntes:\n" +
    brandLines.join("\n") +
    "\n\n" +
    "Una vez el cliente elige un concepto, tu trabajo es reunir suficiente contexto para " +
    "redactar las 4 láminas de forma ACERTADA y coherente entre sí — no te conformes con lo " +
    "mínimo. Esto también aplica cuando el mensaje del cliente ya viene con un tema o un brief " +
    "pegado (por ejemplo, copiado de un plan de contenido): si nombra una lista pero no dice " +
    "cuáles son sus puntos concretos (ej. '5 tips de marketing para mi negocio' sin decir cuáles " +
    "son esos 5 tips), sigue contando como vago — igual que 'un carrusel de tips' sin decir de " +
    "qué, o 'promociona mi negocio' sin decir qué producto u oferta. En cualquiera de esos casos " +
    "HAZ preguntas de seguimiento concretas antes de redactar las láminas (o, si tú mismo puedes " +
    "proponer contenido real y específico con criterio profesional para ese negocio, ofrécelo y " +
    "pide confirmación) — nunca redactes una lámina con un punto genérico y vacío tipo 'tip 1: " +
    "mejora tu marketing' solo por llenar el hueco, y nunca inventes datos específicos del negocio " +
    "(productos, precios, cifras) que el cliente no te haya dado. Cuando el tema ya es claro y " +
    "tienes contenido real para cada punto, decide tú mismo con criterio de neuromarketing y " +
    "diseño persuasivo el estilo visual, el público objetivo y el ángulo de cada lámina.\n\n" +
    "Estructura narrativa esperada de las 4 láminas (guíate por esto salvo que el concepto pida " +
    "algo distinto): lámina 1 = gancho que detiene el scroll y presenta el tema; láminas 2 y 3 = " +
    "desarrollo del contenido (cada una con su propio punto, no repetitivas entre sí); lámina 4 = " +
    "cierre con llamado a la acción. Cada lámina necesita su propio brief autosuficiente — un " +
    "diseñador que solo lea el brief de una lámina, sin ver las otras, debe entender exactamente " +
    "qué debe mostrar/decir esa lámina — pero las 4 deben leerse como una sola pieza narrativa, " +
    "no como 4 piezas sin relación.\n\n" +
    "Reglas de seguridad, nunca las rompas:\n" +
    "- NUNCA inventes precios, descuentos, cifras de negocio o datos concretos que el cliente no " +
    "haya mencionado explícitamente. Si el concepto los necesita, pregúntalos antes de redactar.\n" +
    "- NUNCA inventes un texto legal u obligatorio que deba aparecer en alguna lámina.\n" +
    "- Nunca menciones limitaciones técnicas, que eres una IA, ni te disculpes por no poder " +
    "hacer algo — mantente siempre en el rol de director creativo.\n\n" +
    "Cuando sea el momento adecuado de preguntar el formato/proporción del carrusel (aplica a " +
    "las 4 láminas por igual — cuadrado, vertical, etc.), NO anuncies primero que vas a " +
    "preguntarlo: llama directamente a la función show_aspect_ratio_picker en ese mismo turno. " +
    "La interfaz le mostrará al cliente opciones visuales, y su elección aparecerá como su " +
    "siguiente mensaje.\n\n" +
    "IMPORTANTE: SIEMPRE debes llamar a show_aspect_ratio_picker antes de submit_carousel_details, " +
    "sin excepción, incluso si el cliente ya mencionó un formato — nunca lo asumas por tu cuenta, " +
    "siempre debe elegirlo él mismo en el selector visual.\n\n" +
    "En cuanto tengas contexto suficiente para las 4 láminas y el formato ya elegido por el " +
    "cliente en el selector visual, llama directamente a submit_carousel_details con el título " +
    "del carrusel, el formato, y las 4 láminas en orden (título y brief cada una), en el idioma " +
    "de la conversación (ver arriba), en ese mismo turno. No sigas conversando después de eso.\n\n" +
    "Regla importante sobre estas dos funciones: NUNCA anuncies con texto que vas a mostrar el " +
    "formato o el resumen final, ni preguntes '¿quieres que continúe?' antes de llamarlas — el " +
    "selector visual y la tarjeta de resumen que aparecen después de la función SON el punto de " +
    "confirmación."
  );
}

function buildCalendarSystemPrompt(
  brand: WitBrandContext,
  opts: { monthLabel: string; todayDate: string; monthEndDate: string },
): string {
  const brandLines = [
    `Nombre de la marca: ${brand.companyName}.`,
    brand.brandColors
      ? `Colores de marca ya definidos: ${brand.brandColors}.`
      : "La marca no tiene colores fijos todavía.",
    brand.businessType
      ? `Categoría de negocio: ${brand.businessType}.`
      : "No se especificó categoría de negocio.",
  ];

  return (
    "Eres Wit, el director creativo de IA de WITERS, una agencia de branding por membresía. " +
    "Estás ayudando a un cliente a planificar TODO su calendario de contenido del mes en una " +
    "sola conversación corta — no una pieza a la vez, el mes completo. Es una conversación real " +
    "y natural, no un formulario: sé breve (1-3 frases por turno).\n\n" +
    "Idioma: responde siempre en el mismo idioma en el que te escribe el cliente, y redacta " +
    "también en ese idioma los campos de submit_content_calendar (title, brief). Si cambia de " +
    "idioma a mitad de la conversación, sigue tú el idioma de su último mensaje.\n\n" +
    `Mes que se está planificando: ${opts.monthLabel}. Hoy es ${opts.todayDate}; el mes termina ` +
    `el ${opts.monthEndDate}. Todas las fechas que propongas deben estar entre esas dos, ambas ` +
    "incluidas — nunca antes de hoy.\n\n" +
    "Ya conoces estos datos de la marca del cliente, así que NUNCA los preguntes:\n" +
    brandLines.join("\n") +
    "\n\n" +
    "Necesitas dos cosas del cliente antes de armar el plan: (1) con qué frecuencia quiere " +
    "publicar (ej. 'una vez por semana', 'tres veces por semana', 'todos los días hábiles') y " +
    "(2) de qué temas o pilares de contenido quiere hablar este mes (ej. promociones, detrás de " +
    "cámaras, testimonios, tips, lanzamientos). Pregúntalas de forma natural, una a la vez si " +
    "hace falta — nunca las enumeres como formulario. Si el cliente ya te dio ambas cosas en su " +
    "primer mensaje, no las vuelvas a preguntar.\n\n" +
    "Con la cadencia y los temas ya claros, arma el plan completo tú mismo con criterio " +
    "profesional: calcula las fechas reales del calendario según la cadencia acordada (por " +
    "ejemplo, tres veces por semana suele leerse como lunes/miércoles/viernes, pero ajústalo con " +
    "sentido común), y para cada fecha decide el tema específico de ese día dentro de los pilares " +
    "que dio el cliente. Combina los tres formatos con criterio — imagen, carrusel y video — sin " +
    "repetir el mismo formato todos los días. Usa video con moderación (como mucho una vez por " +
    "semana): el cliente tiene que subir su propio material de video para esa pieza, así que no " +
    "conviene saturar el mes de video.\n\n" +
    "MUY IMPORTANTE — cada brief debe traer contenido real y completo, no solo el tema o el " +
    "ángulo: si la pieza es una lista (ej. '5 tips de marketing', '3 errores comunes', 'pasos " +
    "para...'), tú mismo debes redactar CADA punto de la lista con su contenido específico dentro " +
    "del brief — una frase por punto basta, pero tienen que ser puntos reales y concretos para ese " +
    "negocio, no un título genérico como 'brief: carrusel de 5 tips de marketing'. Quien reciba " +
    "esta pieza (un diseñador, o Wit en una conversación aparte) debe poder trabajarla directo, sin " +
    "tener que volver a preguntar de qué trata cada punto. Para carrusel en particular: en WITERS " +
    "un carrusel siempre son exactamente 4 láminas (gancho, 2 de desarrollo, cierre) — si vas a " +
    "listar puntos, usa como máximo 3 o 4 para que quepan con justicia; nunca prometas una lista " +
    "más larga de la que ese formato puede desarrollar.\n\n" +
    "Reglas de seguridad, nunca las rompas:\n" +
    "- NUNCA inventes precios, descuentos o datos concretos del negocio que el cliente no haya " +
    "mencionado explícitamente.\n" +
    "- Nunca menciones limitaciones técnicas, que eres una IA, ni te disculpes por no poder hacer " +
    "algo — mantente siempre en el rol de director creativo.\n\n" +
    "En cuanto tengas la cadencia y los temas, llama directamente a la función " +
    "submit_content_calendar con el plan completo del mes (una entrada por fecha), en ese mismo " +
    "turno — no anuncies con texto que vas a hacerlo ni preguntes '¿te parece bien?' antes de " +
    "llamarla. La tarjeta de resumen que aparece después de la función es el punto donde el " +
    "cliente revisa y confirma el plan; no necesitas pedir permiso en el chat antes de eso."
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

const CAROUSEL_TOOLS = [
  TOOLS[0], // show_aspect_ratio_picker, sin cambios
  {
    type: "function",
    function: {
      name: "submit_carousel_details",
      description:
        "Llama a esto solo cuando ya tengas las 4 láminas del carrusel listas y coherentes entre sí, incluyendo el formato que el cliente ya eligió en el selector visual.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Título corto para el carrusel completo (máx. 8 palabras).",
          },
          aspectRatio: {
            type: "string",
            enum: ["1:1", "4:3", "3:4", "16:9", "9:16"],
            description:
              "El formato que el cliente eligió en el selector visual, aplica a las 4 láminas.",
          },
          slides: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título corto de esta lámina." },
                brief: {
                  type: "string",
                  description:
                    "Qué debe mostrar/decir esta lámina específica — autosuficiente para un diseñador que solo vea esta lámina, pero coherente con la narrativa de las otras 3.",
                },
              },
              required: ["title", "brief"],
            },
            description: "Las 4 láminas del carrusel, en orden (lámina 1 primero).",
          },
        },
        required: ["title", "aspectRatio", "slides"],
      },
    },
  },
];

const CALENDAR_TOOLS = [
  {
    type: "function",
    function: {
      name: "submit_content_calendar",
      description:
        "Llama a esto cuando ya tengas la cadencia y los temas del mes definidos con el cliente, para entregar el plan completo del mes de una vez.",
      parameters: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description:
                    "Fecha en formato YYYY-MM-DD, dentro del mes que se está planificando.",
                },
                format: {
                  type: "string",
                  enum: ["imagen", "video", "carrusel"],
                  description: "Tipo de pieza para ese día.",
                },
                title: {
                  type: "string",
                  description: "Título corto de la pieza (máx. 8 palabras).",
                },
                brief: {
                  type: "string",
                  description:
                    "Qué debe mostrar/decir esta pieza, con contenido real y completo — suficiente para que un diseñador la haga sin más contexto ni otra conversación. Si es una lista (tips, pasos, razones, etc.), escribe cada punto con su contenido específico, nunca solo el título de la lista.",
                },
              },
              required: ["date", "format", "title", "brief"],
            },
            description:
              "Una entrada por fecha, cubriendo el mes completo según la cadencia acordada.",
          },
        },
        required: ["entries"],
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
  // "shape"/"forma" included alongside "format"/"formato": the system
  // prompt itself asks about "formato/proporción" but is written in
  // Spanish and told to reply in the conversation's language — in English
  // the model has translated that as "shape" in the wild (see the bug
  // report screenshot: "What shape do you picture for your piece?"), not
  // just "format", so anchoring only on "format" missed it.
  const mentionsFormat =
    /\bformato\b|\bforma\b|proporci[oó]n|\bformats?\b|\bshape\b|aspect ratio/.test(t);
  if (!mentionsFormat) return false;
  const promisesOrLists =
    /(te muestro|aqu[ií] tienes|estas son las opciones|opciones:|qu[eé] formato|qu[eé] forma|here('| a)?re|these are the options|options:|what format|what shape)/.test(
      t,
    );
  const mentionsRatios =
    /(1:1|4:3|3:4|16:9|9:16|cuadrado|vertical|horizontal|square|landscape|portrait|story|feed)/.test(
      t,
    );
  return promisesOrLists || mentionsRatios;
}

// Last-resort backstop for when looksLikeAspectRatioAnnouncement's regex
// doesn't recognize the model's exact phrasing — which will always happen
// sooner or later, in either language, because the model's wording is
// genuinely unbounded (that's exactly why clients kept getting stuck
// needing to type "ok": every regex expansion just covers the phrasings
// already seen, never the next new one). Rather than guess with more
// keywords, ask a fresh, cheap, structured call to read the model's own
// draft reply and judge — in any language — whether it's actually
// presenting/about to present the aspect-ratio question, as opposed to a
// legitimate no-tool turn (pitching concepts, asking about photos or
// price). Only reached when both the tool call and the regex already
// missed it, so the added latency only hits the rare fallback path.
async function confirmsAspectRatioAnnouncement(
  apiKey: string,
  draftText: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_TEXT_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Vas a analizar un mensaje escrito por un asistente de diseño gráfico, en " +
              "cualquier idioma. Responde únicamente con la palabra SI si ese mensaje le está " +
              "preguntando al cliente, anunciando, o a punto de mostrarle las opciones de " +
              "formato/proporción/forma (aspect ratio, shape) para una pieza gráfica — por " +
              "ejemplo cuadrado, vertical, horizontal, historia, feed, etc. Responde " +
              "únicamente con la palabra NO si el mensaje trata de cualquier otro tema " +
              "(propuestas de concepto, fotos de referencia, precio o promoción, saludos, " +
              "cualquier otra cosa). Responde solo SI o NO, sin explicación ni puntuación.",
          },
          { role: "user", content: draftText },
        ],
      }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as OpenAiChatResponse;
    const answer = body.choices?.[0]?.message?.content?.trim().toUpperCase();
    return answer?.startsWith("SI") ?? false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// The client's confirmation message ("Elijo el formato: 3:4." / "I choose
// the format: 3:4.") is what proves the visual picker was actually used —
// recorded verbatim by panel.tsx's pickAspectRatio, in whichever language
// the client is using. Matching only the Spanish literal left English
// sessions looking exactly like "picker never used" forever: the tool
// never left the offered list, so the model kept calling it (or announcing
// it) again on every turn no matter how many times the client tapped a
// format — the same stuck loop as if the picker had never been touched.
const ASPECT_PICKER_CONFIRMATION_PREFIXES = ["Elijo el formato:", "I choose the format:"];
function messageConfirmsAspectPicker(content: string): boolean {
  return ASPECT_PICKER_CONFIRMATION_PREFIXES.some((prefix) => content.startsWith(prefix));
}

export async function runWitChat(
  history: WitChatMessage[],
  brand: WitBrandContext,
): Promise<WitChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  // The client's confirmation message ("Elijo el formato: 3:4.") is what
  // proves the visual picker was actually used — recorded verbatim by
  // panel.tsx's pickAspectRatio. Computed up front, before the request even
  // goes out: once the picker has already been used, show_aspect_ratio_picker
  // is dropped from the tools the model is offered, so it's not merely
  // discouraged from calling it again — it physically can't. Relying only on
  // post-hoc filtering of the model's response (the previous approach) still
  // left a gap: the model could call the real tool again on a later turn
  // (not just describe it in text), which reopened the picker after every
  // answer and left the client stuck re-answering the same question forever.
  const pickerWasUsed = history.some(
    (m) => m.role === "user" && messageConfirmsAspectPicker(m.content),
  );
  const tools = pickerWasUsed
    ? TOOLS.filter((tool) => tool.function.name !== "show_aspect_ratio_picker")
    : TOOLS;

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
        tools,
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
  if (!pickerWasUsed) {
    if (
      looksLikeAspectRatioAnnouncement(text) ||
      (await confirmsAspectRatioAnnouncement(apiKey, text))
    ) {
      return { ok: true, kind: "ask_aspect_ratio" };
    }
  }
  return { ok: true, kind: "message", text };
}

export async function runWitCarouselChat(
  history: WitChatMessage[],
  brand: WitBrandContext,
): Promise<WitCarouselChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  // See runWitChat's comment above the equivalent line — same reasoning
  // applies here: dropping the tool once it's already been used (rather
  // than only filtering the response after the fact) is what actually
  // stops the model from calling it a second time.
  const pickerWasUsed = history.some(
    (m) => m.role === "user" && messageConfirmsAspectPicker(m.content),
  );
  const tools = pickerWasUsed
    ? CAROUSEL_TOOLS.filter((tool) => tool.function.name !== "show_aspect_ratio_picker")
    : CAROUSEL_TOOLS;

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
        messages: [{ role: "system", content: buildCarouselSystemPrompt(brand) }, ...history],
        tools,
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
    console.info("[wit-chat] openai failed (carousel)", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  const body = (await response.json()) as OpenAiChatResponse;
  const message = body.choices?.[0]?.message;
  if (!message) return { ok: false, error: "sin_resultado" };

  const toolCall = message.tool_calls?.[0];
  if (toolCall?.function.name === "show_aspect_ratio_picker") {
    return { ok: true, kind: "ask_aspect_ratio" };
  }
  if (toolCall?.function.name === "submit_carousel_details") {
    try {
      const args = JSON.parse(toolCall.function.arguments) as Partial<CarouselDetails>;
      // Same guardrail as the image flow: only trust a format the client
      // actually clicked in the visual picker, never one the model typed.
      if (
        !pickerWasUsed ||
        !args.aspectRatio ||
        !VALID_ASPECT_RATIOS.has(args.aspectRatio.trim())
      ) {
        return { ok: true, kind: "ask_aspect_ratio" };
      }
      const slides = (args.slides ?? [])
        .map((s) => ({ title: s.title?.trim() || "", brief: s.brief?.trim() || "" }))
        .filter((s) => s.brief);
      if (slides.length !== 4) {
        return { ok: false, error: "respuesta_invalida" };
      }
      return {
        ok: true,
        kind: "done",
        details: {
          title: args.title?.trim() || "",
          aspectRatio: args.aspectRatio.trim(),
          slides,
        },
      };
    } catch {
      return { ok: false, error: "respuesta_invalida" };
    }
  }

  const text = message.content?.trim();
  if (!text) return { ok: false, error: "sin_resultado" };
  if (!pickerWasUsed) {
    if (
      looksLikeAspectRatioAnnouncement(text) ||
      (await confirmsAspectRatioAnnouncement(apiKey, text))
    ) {
      return { ok: true, kind: "ask_aspect_ratio" };
    }
  }
  return { ok: true, kind: "message", text };
}

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Same shape as runWitChat/runWitCarouselChat above, but no aspect-ratio
// picker step — the format each piece actually gets requested in is chosen
// later, in that format's own request flow, not here.
export async function runWitCalendarChat(
  history: WitChatMessage[],
  brand: WitBrandContext,
  opts: { monthLabel: string; todayDate: string; monthEndDate: string },
): Promise<WitCalendarChatResult> {
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
        messages: [{ role: "system", content: buildCalendarSystemPrompt(brand, opts) }, ...history],
        tools: CALENDAR_TOOLS,
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
    console.info("[wit-chat] openai failed (calendar)", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  const body = (await response.json()) as OpenAiChatResponse;
  const message = body.choices?.[0]?.message;
  if (!message) return { ok: false, error: "sin_resultado" };

  const toolCall = message.tool_calls?.[0];
  if (toolCall?.function.name === "submit_content_calendar") {
    try {
      const args = JSON.parse(toolCall.function.arguments) as {
        entries?: Array<Partial<CalendarEntryDraft>>;
      };
      const entries = (args.entries ?? [])
        .map((e) => ({
          date: e.date?.trim() ?? "",
          format: e.format,
          title: e.title?.trim() || "",
          brief: e.brief?.trim() || "",
        }))
        .filter(
          (e): e is CalendarEntryDraft =>
            CALENDAR_DATE_RE.test(e.date) &&
            (e.format === "imagen" || e.format === "video" || e.format === "carrusel") &&
            e.title.length > 0 &&
            e.brief.length > 0,
        );
      if (entries.length === 0) return { ok: false, error: "respuesta_invalida" };
      return { ok: true, kind: "done", entries };
    } catch {
      return { ok: false, error: "respuesta_invalida" };
    }
  }

  const calendarText = message.content?.trim();
  if (!calendarText) return { ok: false, error: "sin_resultado" };
  return { ok: true, kind: "message", text: calendarText };
}
