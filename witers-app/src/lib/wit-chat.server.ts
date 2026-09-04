// Powers the live, back-and-forth conversation with "Wit" that a client has
// when creating a design request (panel.tsx's WitConversation) — a real
// multi-turn exchange with ChatGPT itself, not a scripted question list.
// The client always resends the full transcript; this call is otherwise
// stateless, same shape as polish-prompt.server.ts's OpenAI usage.

import process from "node:process";

import {
  detectAllowedWeekdaysFromConversation,
  detectExplicitFormatsFromConversation,
  type Weekday,
} from "./planning-constraints.server";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

export type WitBrandContext = {
  companyName: string;
  brandColors: string | null;
  businessType: string | null;
  hasLogo: boolean;
  // "Memoria inferida" — a compact, evolving summary of what Wit has
  // learned about this specific brand from real signals (a rejected
  // design, a change request), never asked directly. See
  // brand-memory.server.ts. Null until the brand has generated at least
  // one signal.
  brandMemory: string | null;
  // Files explicitly selected from "Mente de marca". Text exports from a
  // strategy/brand document are included verbatim (bounded server-side);
  // visual files are still named so Wit knows they exist, without claiming
  // to have parsed an image or PDF it cannot inspect in this request.
  brandAssets?: { originalName: string; kind: string; textContent: string | null }[];
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
  slot?: number;
  format: CalendarFormat;
  title: string;
  brief: string; // imagen/video: brief completo. carrusel: resumen corto — el contenido real vive en slides.
  slides?: CarouselSlideDraft[]; // siempre 4, solo presente cuando format === "carrusel"
};

// A calendar entry is not merely a topic: it is the production handoff. This
// guard keeps an incomplete outline from being stored as if it were ready for
// a designer, particularly for videos where the script is essential.
export function isProductionReadyCalendarEntry(
  entry: Pick<CalendarEntryDraft, "format" | "title" | "brief" | "slides">,
): boolean {
  const brief = entry.brief.trim();
  if (!entry.title.trim() || !brief) return false;
  if (entry.format === "carrusel")
    return Boolean(
      entry.slides?.length === 4 &&
      entry.slides.every(
        (slide) => slide.title.trim().length > 0 && slide.brief.trim().length >= 20,
      ),
    );
  if (entry.format === "imagen")
    return (
      /(?:composici[oó]n|visual)/i.test(brief) &&
      /(?:texto(?:\s+en\s+(?:pieza|pantalla))?|copy)/i.test(brief) &&
      /(?:cta|llamado a la acci[oó]n)/i.test(brief)
    );
  const sceneCount = new Set(
    [...brief.matchAll(/(?:escena|scene)\s*(\d+)/gi)].map((match) => match[1]),
  ).size;
  return (
    /(?:concepto|idea central|[aá]ngulo)/i.test(brief) &&
    sceneCount >= 3 &&
    /(?:se ve|visual|se muestra)/i.test(brief) &&
    /(?:se dice|locuci[oó]n|voz en off|texto en pantalla)/i.test(brief) &&
    /(?:cta|llamado a la acci[oó]n)/i.test(brief)
  );
}

export type WitCalendarChatResult =
  | { ok: true; kind: "message"; text: string }
  | { ok: true; kind: "done"; entries: CalendarEntryDraft[] }
  | { ok: false; error: string };

export type WitCalendarEntryExpansionResult =
  | { ok: true; title: string; brief: string; slides?: CarouselSlideDraft[] }
  | { ok: false; error: string };

// CAMBIO 02 — "Planificar con Wit": a free-text conversation that gets
// interpreted into the SAME fields guided-planning-sheet.tsx's structured
// wizard already collects (objectives, frequency, weekdays, formats,
// specialInfo), never straight into final calendar entries. The client
// lands back on the wizard's review step to check/correct before the
// (slower, exact-dates) generation in runWitCalendarChat actually runs —
// this is a lightweight extraction step in front of that existing engine,
// not a second way to produce a plan.
export type PlanningObjective = "messages" | "sales" | "community" | "brand" | "other";
export type PlanningBrief = {
  objectives: PlanningObjective[];
  otherObjective: string;
  frequencyPerWeek: number; // 1-7
  weekdays: number[]; // 0=domingo..6=sábado, longitud === frequencyPerWeek
  formats: CalendarFormat[]; // vacío = mezcla recomendada
  // Campañas, fechas clave, restricciones, temas e instrucciones extra que
  // no tienen un campo dedicado en el wizard — igual que el textarea libre
  // del paso "¿Hay algo importante este mes?", consolidado en un solo texto.
  specialInfo: string;
};
export type WitPlanningChatResult =
  | { ok: true; kind: "message"; text: string }
  | { ok: true; kind: "done"; brief: PlanningBrief }
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
  if (brand.brandMemory) {
    brandLines.push(
      `Aprendizajes previos sobre esta marca, inferidos de piezas rechazadas o cambios ` +
        `solicitados — tenlos en cuenta con criterio profesional, pero nunca los menciones ` +
        `explícitamente al cliente ni le preguntes por ellos: ${brand.brandMemory}`,
    );
  }
  if (brand.brandAssets?.length) {
    // Keep the source material bounded and high-signal. A pile of complete
    // manuals can otherwise crowd the active conversation out of context.
    let remainingBrandText = 12_000;
    const textAssets = brand.brandAssets
      .filter((a) => a.textContent)
      .flatMap((a) => {
        if (!a.textContent || remainingBrandText <= 0) return [];
        const excerpt = a.textContent.slice(0, remainingBrandText).trim();
        remainingBrandText -= excerpt.length;
        return excerpt ? [`Archivo ${a.kind} “${a.originalName}”:\n${excerpt}`] : [];
      });
    const visualAssets = brand.brandAssets
      .filter((a) => !a.textContent)
      .map((a) => `${a.kind}: ${a.originalName}`);
    if (textAssets.length)
      brandLines.push(
        `Información aportada en Mente de marca (fuente de verdad para esta planificación):\n${textAssets.join("\n\n")}`,
      );
    if (visualAssets.length)
      brandLines.push(`Archivos de referencia disponibles: ${visualAssets.join(", ")}.`);
  }

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
  if (brand.brandMemory) {
    brandLines.push(
      `Aprendizajes previos sobre esta marca, inferidos de piezas rechazadas o cambios ` +
        `solicitados — tenlos en cuenta con criterio profesional, pero nunca los menciones ` +
        `explícitamente al cliente ni le preguntes por ellos: ${brand.brandMemory}`,
    );
  }
  if (brand.brandAssets?.length) {
    let remainingBrandText = 12_000;
    const textAssets = brand.brandAssets
      .filter((a) => a.textContent)
      .flatMap((a) => {
        if (!a.textContent || remainingBrandText <= 0) return [];
        const excerpt = a.textContent.slice(0, remainingBrandText).trim();
        remainingBrandText -= excerpt.length;
        return excerpt ? [`Archivo ${a.kind} “${a.originalName}”:\n${excerpt}`] : [];
      });
    const visualAssets = brand.brandAssets
      .filter((a) => !a.textContent)
      .map((a) => `${a.kind}: ${a.originalName}`);
    if (textAssets.length)
      brandLines.push(
        `Información aportada en Mente de marca (fuente de verdad para esta planificación):\n${textAssets.join("\n\n")}`,
      );
    if (visualAssets.length)
      brandLines.push(`Archivos de referencia disponibles: ${visualAssets.join(", ")}.`);
  }

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
  opts: {
    monthLabel: string;
    todayDate: string;
    monthEndDate: string;
    existingEntries?: { date: string; title: string }[];
    expectedEntries?: number;
    exactDates?: string[];
    maxPostsPerDay?: 1 | 2;
    // CAMBIO 15 — when the client confirmed specific formats (not "mezcla
    // recomendada"), this is the exact, already-decided format for each
    // exactDates entry. Turns format compliance from a soft prompt
    // preference into the same kind of hard, code-checked requirement dates
    // already have — see validatePlanningFormats in calendar-chat.ts.
    formatByDate?: Record<string, "imagen" | "video" | "carrusel">;
  },
): string {
  const brandLines = [
    `Nombre de la marca: ${brand.companyName}.`,
    brand.brandColors
      ? `Colores de marca ya definidos: ${brand.brandColors}.`
      : "La marca no tiene colores fijos todavía.",
    brand.businessType
      ? `Categoría de negocio: ${brand.businessType}.`
      : "No se especificó categoría de negocio.",
    brand.hasLogo
      ? "La marca tiene un logotipo oficial disponible para el cierre de video; úsalo, nunca lo recrees ni lo sustituyas."
      : "La marca no tiene un logotipo oficial disponible; no inventes uno.",
  ];
  if (brand.brandMemory) {
    brandLines.push(
      `Aprendizajes previos sobre esta marca, inferidos de piezas rechazadas o cambios ` +
        `solicitados — tenlos en cuenta con criterio profesional, pero nunca los menciones ` +
        `explícitamente al cliente ni le preguntes por ellos: ${brand.brandMemory}`,
    );
  }
  if (brand.brandAssets?.length) {
    // Calendar plans can need many detailed tool entries. Keep the Mente de
    // marca useful without allowing a large document (or several documents)
    // to consume the model context reserved for those entries.
    // The monthly planner needs to respond quickly. The full source stays
    // available when a specific piece is expanded for production later.
    let remainingBrandText = 2_000;
    const textAssets = brand.brandAssets
      .filter((a) => a.textContent)
      .flatMap((a) => {
        if (!a.textContent || remainingBrandText <= 0) return [];
        const excerpt = a.textContent.slice(0, remainingBrandText).trim();
        remainingBrandText -= excerpt.length;
        return excerpt ? [`Archivo ${a.kind} “${a.originalName}”: ${excerpt}`] : [];
      });
    const visualAssets = brand.brandAssets
      .filter((a) => !a.textContent)
      .map((a) => `${a.kind}: ${a.originalName}`);
    if (textAssets.length)
      brandLines.push(`Información aportada en Mente de marca:\n${textAssets.join("\n")}`);
    if (visualAssets.length)
      brandLines.push(`Archivos de referencia disponibles: ${visualAssets.join(", ")}.`);
  }

  return (
    "Eres Wit, el director creativo de IA de WITERS, una agencia de branding por membresía. " +
    "Estás ayudando a un cliente con su planificación de contenido. Puede querer llenar el mes, " +
    "publicar algunos días o simplemente conversar una idea: sigue su intención, responde sus preguntas " +
    "directamente y nunca lo fuerces a un formulario. Es una conversación real y natural; sé claro, " +
    "propositivo y breve (1-3 frases por turno).\n\n" +
    "Idioma: responde siempre en el mismo idioma en el que te escribe el cliente, y redacta " +
    "también en ese idioma los campos de submit_content_calendar (title, brief). Si cambia de " +
    "idioma a mitad de la conversación, sigue tú el idioma de su último mensaje.\n\n" +
    `Mes que se está planificando: ${opts.monthLabel}. Hoy es ${opts.todayDate}; el mes termina ` +
    `el ${opts.monthEndDate}. Todas las fechas que propongas deben estar entre esas dos, ambas ` +
    "incluidas — nunca antes de hoy.\n\n" +
    `Este cliente puede planificar como máximo ${opts.maxPostsPerDay ?? 1} ${opts.maxPostsPerDay === 2 ? "piezas" : "pieza"} por día. ` +
    "Es un máximo, no una obligación: respeta siempre la frecuencia que el cliente elija.\n\n" +
    (opts.existingEntries?.length
      ? "Estas fechas de este mes YA tienen una pieza planeada (el cliente ya la pidió o la " +
        "tiene en curso) — NUNCA propongas ninguna de estas fechas de nuevo, ni las cuentes " +
        "como huecos vacíos al calcular la cadencia; solo estás completando el resto del mes " +
        "alrededor de ellas:\n" +
        opts.existingEntries.map((e) => `- ${e.date}: ${e.title}`).join("\n") +
        "\n\n"
      : "") +
    "Ya conoces estos datos de la marca del cliente, así que NUNCA los preguntes:\n" +
    brandLines.join("\n") +
    "\n\n" +
    (brand.brandAssets?.some((asset) => asset.textContent)
      ? "La Mente de marca ya está disponible en tu contexto. Úsala activamente para proponer pilares, tono, público y mensajes; si hablas de ella, di 'con base en tu Mente de marca' y menciona un dato concreto que esté en el material. NUNCA digas que no tienes acceso a los archivos ni que solo puedes usar información genérica. Los archivos sin texto extraíble son referencias visuales y no debes fingir que los leíste.\n\n"
      : "No hay texto extraíble seleccionado en Mente de marca. Usa los datos del perfil y pide al cliente únicamente los pilares que falten, sin mencionar limitaciones técnicas.\n\n") +
    "Antes de crear entradas, identifica la cadencia y los temas solo si realmente faltan. El cliente " +
    "puede decirlos de cualquier manera ('lunes, miércoles y viernes', 'cuando tenga promociones', " +
    "'llena septiembre') y puede hacer preguntas intermedias: interprétalo con criterio. Pregunta una " +
    "sola cosa concreta únicamente cuando no puedas inferirla. Si la Mente de marca define pilares, " +
    "úsalos activamente y pide solo la confirmación o el foco que falte; no repitas preguntas ya resueltas.\n\n" +
    "Con la cadencia y los temas ya claros, arma el plan completo tú mismo con criterio " +
    "profesional: calcula las fechas reales del calendario según la cadencia acordada (por " +
    "ejemplo, tres veces por semana suele leerse como lunes/miércoles/viernes, pero ajústalo con " +
    "sentido común), y para cada fecha decide el tema específico de ese día dentro de los pilares " +
    "que dio el cliente. Combina los tres formatos con criterio — imagen, carrusel y video — sin " +
    "repetir el mismo formato todos los días. Usa video con moderación (como mucho una vez por " +
    "semana): el cliente tiene que subir su propio material de video para esa pieza, así que no " +
    "conviene saturar el mes de video.\n\n" +
    // CAMBIO 04 — construir la estrategia antes de bajar a piezas: función
    // por pieza dentro del funnel, distribución no repetitiva, y reparto
    // real entre los objetivos del cliente cuando eligió más de uno.
    "PLANEACIÓN ESTRATÉGICA, no solo llenar fechas: antes de escribir cada pieza, decide con qué " +
    "función de funnel trabaja — awareness, educación, autoridad, confianza, comunidad, " +
    "consideración, conversión, retención o engagement/captación de leads — y repártelas con " +
    "criterio a lo largo del mes según los objetivos del cliente. NUNCA repitas una secuencia fija " +
    "(ej. consejo → promoción → testimonio → detrás de cámaras → repetir); cada pieza responde a " +
    "una decisión distinta, no a un patrón rotativo.\n\n" +
    "Si el cliente dio varios objetivos a la vez, NO le dediques el mes solo al primero: reparte " +
    "las piezas entre todos con un peso razonable — por ejemplo, con objetivos de ventas y de " +
    "comunidad, alterna piezas de conversión con piezas de awareness/engagement en vez de que un " +
    "objetivo domine el calendario completo.\n\n" +
    "EVITAR CONTENIDO GENÉRICO — regla obligatoria: si una pieza podría publicarse prácticamente " +
    "igual para cualquier otro negocio de la misma categoría, no sirve. Rehazla usando elementos " +
    "concretos y reales de ESTA marca: productos o servicios específicos, beneficios reales, " +
    "objeciones o dudas típicas del cliente, casos de uso, diferenciadores frente a la " +
    "competencia, vocabulario propio de la marca, promociones o campañas que el cliente mencionó, " +
    "ubicación si aplica. Usa esos datos cuando estén disponibles en el perfil, la Mente de marca o " +
    "lo que el cliente ya contó — nunca inventes datos que no te dieron, pero tampoco caigas en " +
    "genéricos vacíos ('un buen servicio', 'la mejor calidad') cuando sí tienes con qué ser " +
    "específico. Títulos como 'Consejo de marketing' o 'Detrás de cámaras' sin ningún dato " +
    "concreto de la marca no cumplen este estándar.\n\n" +
    "Cada pieza debe quedar lista para producción, no solo como un tema. Este requisito es obligatorio: una entrada incompleta será rechazada. " +
    "La primera línea del brief siempre debe ser 'PILAR: <pilar de contenido> | ETAPA: <función de funnel de la lista de arriba> | AUDIENCIA: <a quién le habla esta pieza específica>', seguida en la misma línea o la siguiente de 'MÉTRICA: <qué métrica de esta red mide mejor si funcionó>'. Después de esa línea, sigue el desarrollo propio del formato:\n" +
    "Imagen: INSIGHT (por qué le importa esto a esta audiencia), HOOK (primera línea/elemento que detiene el scroll), CONCEPTO, COMPOSICIÓN, JERARQUÍA VISUAL, TEXTO EN PIEZA (copy principal y, si aplica, secundario) y CTA. " +
    "Carrusel: usa brief como resumen (con la línea PILAR/ETAPA/AUDIENCIA/MÉTRICA) y entrega exactamente 4 láminas en slides — portada con HOOK real, dos láminas de desarrollo concreto y cierre con CTA; cada lámina debe ser autosuficiente y contener diseño/copy concreto, nunca genérico. " +
    "Video: HOOK INICIAL (primeros 2 segundos), CONCEPTO, GUION AIDA, ESCENA 1 a ESCENA 3-5 con ‘Se ve:’ y ‘Se dice:’ en cada una, TEXTO EN PANTALLA, RITMO (rápido/pausado y por qué), DURACIÓN SUGERIDA, SUBTÍTULOS, CTA y CIERRE. " +
    "Después del CTA, si la marca tiene logotipo, añade un cierre profesional con logo y fade-out. No uses markdown ni inventes datos del negocio.\n\n" +
    "Reglas de seguridad, nunca las rompas:\n" +
    "- NUNCA inventes precios, descuentos o datos concretos del negocio que el cliente no haya " +
    "mencionado explícitamente.\n" +
    "- Nunca menciones limitaciones técnicas, que eres una IA, ni te disculpes por no poder hacer " +
    "algo — mantente siempre en el rol de director creativo.\n\n" +
    "En cuanto tengas la cadencia y los temas, llama directamente a la función " +
    "submit_content_calendar con el plan completo del mes (una entrada por fecha), en ese mismo " +
    "turno — no anuncies con texto que vas a hacerlo ni preguntes '¿te parece bien?' antes de " +
    "llamarla. La tarjeta de resumen que aparece después de la función es el punto donde el " +
    "cliente revisa y confirma el plan; no necesitas pedir permiso en el chat antes de eso.\n\n" +
    "IMPORTANTE — llama a submit_content_calendar UNA SOLA VEZ, con TODAS las fechas del mes " +
    "completo calculadas según la cadencia acordada, nunca solo la primera semana ni el plan " +
    "dividido en varias llamadas: si el cliente pidió 'martes y jueves', calcula y entrega TODOS " +
    "los martes y jueves del mes en esa única llamada, no solo los primeros.\n\n" +
    (opts.expectedEntries
      ? `El cliente pidió exactamente ${opts.expectedEntries} piezas nuevas. Debes entregar exactamente ${opts.expectedEntries} entradas válidas; una respuesta con menos entradas es un plan incompleto y no sirve.\n\n`
      : "") +
    (opts.exactDates?.length
      ? `Las fechas objetivo fueron seleccionadas por el usuario y son autoritativas: ${opts.exactDates.join(", ")}. Debes crear exactamente una pieza por cada slot de esa lista. No agregues, elimines, reordenes ni infieras fechas; el código asignará las fechas objetivo a los slots en ese orden.\n\n`
      : "") +
    (opts.formatByDate
      ? "El formato de cada pieza YA FUE DECIDIDO por el cliente y es obligatorio — no lo " +
        "cambies, no lo reinterpretes, no lo sustituyas por otro formato aunque te parezca mejor " +
        "para el tema: usa exactamente este formato para cada fecha, en el mismo orden de la " +
        "lista de fechas de arriba:\n" +
        opts
          .exactDates!.map((date) => `- ${date}: formato obligatorio "${opts.formatByDate![date]}"`)
          .join("\n") +
        "\n\n"
      : "") +
    "Si en algún momento ves en la conversación un mensaje tuyo que empieza con 'Plan propuesto " +
    "para el mes:' seguido de una lista de fechas, ya le habías propuesto un plan al cliente antes " +
    "de este turno — trátalo como el plan actual vigente, no como algo nuevo. Si el cliente dice " +
    "que no le gusta, que quiere ajustarlo, o pide un cambio puntual (de un día, de un tema, de la " +
    "mezcla de formatos, etc.), NUNCA te disculpes ni repitas el plan tal cual: pregúntale, en tono " +
    "conversacional y una cosa a la vez, qué específicamente no le convenció o qué prefiere " +
    "distinto — no vuelvas a preguntar la cadencia ni los temas generales si ya te los dio, solo " +
    "profundiza en el ajuste puntual. En cuanto tengas claro qué cambiar, vuelve a llamar a " +
    "submit_content_calendar con el plan COMPLETO y actualizado del mes (repite tal cual las " +
    "entradas que no cambiaron, actualiza solo las que el cliente pidió ajustar), con el mismo " +
    "nivel de profundidad profesional de siempre — nunca solo las entradas nuevas ni un plan " +
    "parcial."
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
                slot: {
                  type: "integer",
                  enum: [1, 2],
                  description:
                    "Turno de publicación en esa fecha. Usa 1 salvo que se soliciten dos piezas ese día.",
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
                    "Brief final de producción. Imagen: composición, texto exacto y CTA. Video: guion AIDA con 3-5 escenas, qué se ve/dice, subtítulos minimalistas de una línea y cierre de logo con fade-out si existe. Carrusel: resumen; las 4 láminas completas van en slides.",
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
                  description:
                    "Solo para format:'carrusel' — las 4 láminas del carrusel, en orden (lámina 1 primero: gancho, 2-3 desarrollo, 4 cierre). Omitir para imagen/video.",
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

const CALENDAR_ENTRY_EXPANSION_TOOLS = [
  {
    type: "function",
    function: {
      name: "submit_production_details",
      description: "Entrega el brief final de producción de esta única pieza.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título claro de la pieza." },
          brief: {
            type: "string",
            description:
              "Brief final. Imagen: composición, copy exacto y CTA. Video: guion AIDA con 3-5 escenas, qué se ve/dice, subtítulos y cierre de logo. Carrusel: resumen breve; sus láminas van en slides.",
          },
          slides: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                brief: {
                  type: "string",
                  description: "Contenido final, claro y autosuficiente de la lámina.",
                },
              },
              required: ["title", "brief"],
            },
            description:
              "Obligatorio solo para carrusel: 4 láminas, gancho, desarrollo, desarrollo y CTA.",
          },
        },
        required: ["title", "brief"],
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
  const timer = setTimeout(() => controller.abort(), 28_000);
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
        max_tokens: 1800,
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
  opts: {
    monthLabel: string;
    todayDate: string;
    monthEndDate: string;
    existingEntries?: { date: string; title: string }[];
    expectedEntries?: number;
    exactDates?: string[];
    maxPostsPerDay?: 1 | 2;
    formatByDate?: Record<string, "imagen" | "video" | "carrusel">;
    // A partially formed carousel/video must not discard the valid dates
    // around it. The route retries only the missing exact dates afterwards.
    allowPartial?: boolean;
  },
): Promise<WitCalendarChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);
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
        max_tokens: 8000,
        messages: [{ role: "system", content: buildCalendarSystemPrompt(brand, opts) }, ...history],
        tools: CALENDAR_TOOLS,
        tool_choice: "auto",
        // A full month's worth of fully-fleshed entries (video scripts,
        // 4-slide carousels) is a large payload — without this, the model
        // sometimes splits it across multiple tool_calls (e.g. one per
        // week) instead of one big one. Force a single call so nothing
        // downstream can silently read only the first chunk.
        parallel_tool_calls: false,
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
    if (response.status === 429) return { ok: false, error: "limite_openai" };
    if (response.status >= 500) return { ok: false, error: "proveedor_openai" };
    return { ok: false, error: "configuracion_openai" };
  }

  const body = (await response.json()) as OpenAiChatResponse;
  const message = body.choices?.[0]?.message;
  if (!message) return { ok: false, error: "sin_resultado" };

  // parallel_tool_calls:false above should keep this to one call, but read
  // every submit_content_calendar call present (not just the first) as a
  // second line of defense — silently reading only tool_calls[0] is
  // exactly what dropped whole weeks of a plan before this fix.
  const calendarCalls = (message.tool_calls ?? []).filter(
    (c) => c.function.name === "submit_content_calendar",
  );
  if (calendarCalls.length > 0) {
    try {
      type RawArgs = {
        entries?: Array<
          Partial<CalendarEntryDraft> & { slides?: Array<Partial<CarouselSlideDraft>> }
        >;
      };
      const allEntries = calendarCalls.flatMap(
        (c) => (JSON.parse(c.function.arguments) as RawArgs).entries ?? [],
      );
      type RawCalendarEntry = {
        date: string;
        slot?: number;
        format?: CalendarFormat;
        title: string;
        brief: string;
        slides?: CarouselSlideDraft[];
      };
      const mapped: RawCalendarEntry[] = allEntries.map((e) => {
        const raw: RawCalendarEntry = {
          date: e.date?.trim() ?? "",
          slot: e.slot === 2 ? 2 : 1,
          format: e.format,
          title: e.title?.trim() || "",
          brief: e.brief?.trim() || "",
        };
        if (e.format === "carrusel") {
          raw.slides = (e.slides ?? [])
            .map((s) => ({ title: s.title?.trim() || "", brief: s.brief?.trim() || "" }))
            .filter((s) => s.brief);
        }
        return raw;
      });
      const structurallyValidEntries = mapped.filter(
        (e): e is CalendarEntryDraft =>
          // In date-locked planning the model supplies content for ordered
          // slots, not calendar authority. A malformed echoed date must not
          // discard an otherwise valid piece; WITERS assigns target dates.
          (opts.exactDates || CALENDAR_DATE_RE.test(e.date)) &&
          (e.format === "imagen" || e.format === "video" || e.format === "carrusel") &&
          e.title.length > 0 &&
          e.brief.length > 0 &&
          // A carrusel entry without its 4 real slides is exactly the
          // "topic, not content" shallowness this whole system prompt
          // exists to prevent — drop it rather than let a client review
          // and confirm a plan that createCarouselRequest can't actually
          // build from later.
          (e.format !== "carrusel" || e.slides?.length === 4),
      );
      const validEntries = structurallyValidEntries.filter(isProductionReadyCalendarEntry);
      // Dates are controlled by WITERS, not by the model. The model fills
      // ordered content slots and the server assigns the user-selected dates.
      const entries = opts.exactDates
        ? validEntries
            .slice(0, opts.exactDates.length)
            .map((entry, index) => ({ ...entry, date: opts.exactDates![index] }))
        : validEntries;
      if (entries.length === 0) return { ok: false, error: "respuesta_invalida" };
      if (!opts.allowPartial && opts.expectedEntries && entries.length !== opts.expectedEntries) {
        console.info("[wit-chat] incomplete calendar plan", {
          expected: opts.expectedEntries,
          received: entries.length,
        });
        return { ok: false, error: "plan_incompleto" };
      }
      if (!opts.allowPartial && opts.exactDates) {
        const receivedDates = new Set(entries.map((entry) => entry.date));
        const datesMatch =
          receivedDates.size === opts.exactDates.length &&
          opts.exactDates.every((date) => receivedDates.has(date));
        if (!datesMatch) {
          console.info("[wit-chat] calendar batch used unexpected dates", {
            expected: opts.exactDates,
            received: [...receivedDates],
          });
          return { ok: false, error: "plan_incompleto" };
        }
      }
      return { ok: true, kind: "done", entries };
    } catch {
      return { ok: false, error: "respuesta_invalida" };
    }
  }

  const calendarText = message.content?.trim();
  if (!calendarText) return { ok: false, error: "sin_resultado" };
  return { ok: true, kind: "message", text: calendarText };
}

// Legacy recovery for entries created before calendar planning required a
// complete production brief. New monthly plans arrive production-ready.
export async function runWitCalendarEntryExpansion(
  entry: Pick<CalendarEntryDraft, "format" | "title" | "brief" | "slides">,
  brand: WitBrandContext,
): Promise<WitCalendarEntryExpansionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const brandContext = [
    `Marca: ${brand.companyName}.`,
    brand.businessType ? `Categoría: ${brand.businessType}.` : "",
    brand.brandColors ? `Colores: ${brand.brandColors}.` : "",
    brand.hasLogo
      ? "La marca tiene logo: cierra cada video después del CTA con logo, entrada suave y fade-out profesional."
      : "",
    brand.brandMemory ? `Aprendizajes de marca: ${brand.brandMemory}` : "",
    ...(brand.brandAssets ?? [])
      .filter((asset) => asset.textContent)
      .map(
        (asset) => `Mente de marca (${asset.originalName}): ${asset.textContent?.slice(0, 4000)}`,
      ),
  ]
    .filter(Boolean)
    .join("\n");
  const system =
    "Eres Wit, director creativo de WITERS. Convierte la ficha de calendario (un esbozo antiguo, " +
    "sin el detalle profesional que se pide hoy) en un brief final listo para producción. " +
    "Responde en español y usa solo submit_production_details. No inventes precios, promociones ni " +
    "datos que no estén ya en la ficha o en el contexto de marca de abajo. Si un dato concreto de " +
    "la marca (producto, diferenciador, promoción) está disponible, úsalo — evita que el brief " +
    "final quede genérico, intercambiable con cualquier otro negocio de la categoría.\n\n" +
    "La primera línea del brief debe ser 'PILAR: <pilar de contenido> | ETAPA: <awareness/" +
    "educación/autoridad/confianza/comunidad/consideración/conversión/retención/engagement> | " +
    "AUDIENCIA: <a quién le habla esta pieza>'. " +
    "Imagen: además, INSIGHT, HOOK, CONCEPTO, composición, copy en pieza y CTA. Carrusel: entrega " +
    "exactamente cuatro láminas autosuficientes (portada con hook real, desarrollo, cierre con " +
    "CTA). Video: HOOK INICIAL, CONCEPTO, guion AIDA en 3-5 escenas — para cada escena qué se ve y " +
    "qué se dice —, subtítulos minimalistas de una sola línea, sombra sutil, sin contraste duro; " +
    "después del CTA, logo con fade-out cuando exista.\n\n" +
    brandContext;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_TEXT_MODEL,
        temperature: 0.5,
        max_tokens: 1800,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Ficha de calendario a desarrollar:\nFormato: ${entry.format}\nTítulo: ${entry.title}\nResumen: ${entry.brief}${entry.slides?.length ? `\nLáminas iniciales: ${JSON.stringify(entry.slides)}` : ""}`,
          },
        ],
        tools: CALENDAR_ENTRY_EXPANSION_TOOLS,
        tool_choice: { type: "function", function: { name: "submit_production_details" } },
      }),
    });
    if (!response.ok) return { ok: false, error: "openai_error" };
    const body = (await response.json()) as OpenAiChatResponse;
    const call = body.choices?.[0]?.message?.tool_calls?.find(
      (candidate) => candidate.function.name === "submit_production_details",
    );
    if (!call) return { ok: false, error: "respuesta_invalida" };
    const args = JSON.parse(call.function.arguments) as Partial<{
      title: string;
      brief: string;
      slides: Array<Partial<CarouselSlideDraft>>;
    }>;
    const slides = args.slides
      ?.map((slide) => ({ title: slide.title?.trim() || "", brief: slide.brief?.trim() || "" }))
      .filter((slide) => slide.brief);
    if (
      !args.title?.trim() ||
      !args.brief?.trim() ||
      (entry.format === "carrusel" && slides?.length !== 4)
    ) {
      return { ok: false, error: "respuesta_invalida" };
    }
    return {
      ok: true,
      title: args.title.trim().slice(0, 120),
      brief: args.brief.trim().slice(0, 2000),
      ...(entry.format === "carrusel" ? { slides: slides as CarouselSlideDraft[] } : {}),
    };
  } catch (error) {
    console.warn(
      "[wit-chat] calendar entry expansion failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }
}

function buildPlanningBriefSystemPrompt(
  brand: WitBrandContext,
  opts: {
    monthLabel: string;
    mode: "create" | "adjust";
    existingEntries: { date: string; format: CalendarFormat; title: string }[];
  },
): string {
  const brandLines = [
    `Marca: ${brand.companyName}.`,
    brand.businessType ? `Categoría: ${brand.businessType}.` : "",
    brand.brandMemory ? `Aprendizajes previos de esta marca: ${brand.brandMemory}` : "",
  ].filter(Boolean);
  const existingPlanLines = opts.existingEntries.length
    ? "El cliente YA TIENE un plan para este mes — esta conversación es para AJUSTARLO, no para " +
      "proponer uno nuevo desde cero. Estas son las piezas ya planeadas (no las repitas, no las " +
      "cuentes como huecos vacíos):\n" +
      opts.existingEntries
        .slice(0, 40)
        .map((e) => `- ${e.date} (${e.format}): ${e.title}`)
        .join("\n") +
      "\n\n"
    : "";
  return (
    "Eres Wit, el director creativo de IA de WITERS, el mismo Wit con el que el cliente ya habla " +
    "para crear piezas — no eres un asistente distinto ni un formulario. Estás conversando con él " +
    `sobre su planificación de ${opts.monthLabel}. ` +
    (opts.mode === "adjust"
      ? "El cliente quiere AJUSTAR el plan que ya tiene."
      : "El cliente quiere ARMAR su plan del mes.") +
    " Puede escribirte en una frase, un párrafo o instrucciones largas — objetivos, prioridades, " +
    "frecuencia, formatos, fechas importantes, campañas, restricciones, temas, o cualquier otra " +
    "instrucción. Puede también hacerte preguntas o pedirte una recomendación a mitad de la " +
    "conversación — respóndelas de verdad, con criterio profesional, no las evadas ni las " +
    "conviertas en otra pregunta.\n\n" +
    "Idioma: responde siempre en el mismo idioma en el que te escribe el cliente.\n\n" +
    brandLines.join("\n") +
    "\n\n" +
    existingPlanLines +
    "CONVERSA DE VERDAD, no interrogues — esto NO es un formulario disfrazado de chat:\n" +
    "- NUNCA preguntes algo que el cliente ya dijo o que puedas inferir con criterio profesional. " +
    "Si dijo 'cinco días a la semana, de lunes a viernes', ya sabes la frecuencia Y los días — no " +
    "vuelvas a preguntar cuáles. Solo pregunta cuando haya una ambigüedad real (ej. 'cinco " +
    "contenidos' sin decir si es al mes o por semana).\n" +
    "- Si el cliente pide una recomendación ('¿me recomiendas cómo distribuir los formatos?', 'no sé " +
    "qué tan seguido publicar', 'recomiéndame'), dale una recomendación concreta y útil en 2-3 " +
    "frases, basada en su marca y categoría de negocio — no llames a submit_planning_brief todavía " +
    "si con eso no tienes ya objetivo y frecuencia claros.\n" +
    "- Cuando ya tengas objetivo(s) y frecuencia/cadencia razonablemente claros, tienes dos caminos: " +
    "si el cliente te dio todo eso de forma completa y explícita en un solo mensaje, llama a " +
    "submit_planning_brief directamente, sin pedir confirmación de más (no le hagas perder tiempo). " +
    "Si en cambio llegaste ahí después de varias preguntas o inferencias tuyas, resume en 1-2 frases " +
    "de texto lo que armaste y pregunta si genera su plan con eso — solo llama a la función cuando " +
    "confirme ('sí', 'dale', 'genera', 'perfecto', o equivalente).\n" +
    "- Si el cliente no menciona frecuencia, asume 3 veces por semana (lunes, miércoles y viernes) y " +
    "dilo al resumir, no lo asumas en silencio. Si no menciona formatos, deja formats vacío " +
    "(mezcla recomendada). Cualquier fecha, promoción, lanzamiento, restricción, campaña o tema que " +
    "mencione va consolidado en specialInfo, en frases cortas y claras.\n\n" +
    "Cuando SÍ respondas con texto normal (sin llamar a la función), sé breve — 1-3 frases — y NUNCA " +
    "en esa respuesta propongas piezas, anuncios, frases publicitarias, listas o ejemplos de " +
    "contenido concreto: eso llega después, cuando ya se genera el plan real.\n\n" +
    "Reglas de seguridad, nunca las rompas: nunca menciones limitaciones técnicas, que eres una IA, " +
    "ni te disculpes por no poder hacer algo — mantente siempre en el rol de director creativo."
  );
}

const PLANNING_BRIEF_TOOLS = [
  {
    type: "function",
    function: {
      name: "submit_planning_brief",
      description:
        "Llama a esto en cuanto tengas suficiente información interpretada del mensaje del cliente, casi siempre en el primer turno.",
      parameters: {
        type: "object",
        properties: {
          objectives: {
            type: "array",
            items: { type: "string", enum: ["messages", "sales", "community", "brand", "other"] },
            minItems: 1,
            description:
              "Uno o varios: messages (más mensajes/conversaciones), sales (más ventas), community (crecer comunidad/audiencia), brand (posicionar marca), other (otro objetivo distinto).",
          },
          otherObjective: {
            type: "string",
            description:
              "Solo si 'other' está en objectives: describe ese objetivo en pocas palabras.",
          },
          frequencyPerWeek: {
            type: "integer",
            minimum: 1,
            maximum: 7,
            description: "Piezas por semana. Si no se menciona, usa 3.",
          },
          weekdays: {
            type: "array",
            items: { type: "integer", minimum: 0, maximum: 6 },
            description:
              "Días de la semana (0=domingo..6=sábado), debe tener exactamente frequencyPerWeek elementos.",
          },
          formats: {
            type: "array",
            items: { type: "string", enum: ["imagen", "video", "carrusel"] },
            description:
              "Formatos que el cliente priorizó explícitamente. Vacío si no mencionó ninguno.",
          },
          specialInfo: {
            type: "string",
            description:
              "Campañas, lanzamientos, fechas clave, restricciones, temas e instrucciones adicionales, en frases cortas. Cadena vacía si no hay nada.",
          },
        },
        required: ["objectives", "frequencyPerWeek", "weekdays", "formats", "specialInfo"],
        additionalProperties: false,
      },
    },
  },
];

export async function runWitPlanningBrief(
  history: WitChatMessage[],
  brand: WitBrandContext,
  opts: {
    monthLabel: string;
    mode: "create" | "adjust";
    existingEntries: { date: string; format: CalendarFormat; title: string }[];
  },
): Promise<WitPlanningChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
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
        max_tokens: 900,
        messages: [
          { role: "system", content: buildPlanningBriefSystemPrompt(brand, opts) },
          ...history,
        ],
        tools: PLANNING_BRIEF_TOOLS,
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
    console.info(
      "[wit-chat] openai failed (planning brief)",
      response.status,
      detail.slice(0, 500),
    );
    return { ok: false, error: "openai_error" };
  }

  const body = (await response.json()) as OpenAiChatResponse;
  const message = body.choices?.[0]?.message;
  if (!message) return { ok: false, error: "sin_resultado" };

  const call = message.tool_calls?.find((c) => c.function.name === "submit_planning_brief");
  if (call) {
    try {
      const args = JSON.parse(call.function.arguments) as Partial<{
        objectives: string[];
        otherObjective: string;
        frequencyPerWeek: number;
        weekdays: number[];
        formats: string[];
        specialInfo: string;
      }>;
      const validObjectives = new Set(["messages", "sales", "community", "brand", "other"]);
      const objectives = (args.objectives ?? []).filter((o): o is PlanningObjective =>
        validObjectives.has(o),
      );
      if (!objectives.length) return { ok: false, error: "respuesta_invalida" };
      const validFormats = new Set(["imagen", "video", "carrusel"]);
      const modelFormats = (args.formats ?? []).filter((f): f is CalendarFormat =>
        validFormats.has(f),
      );
      // CAMBIO 15 — same gap as CAMBIO 07's weekdays: the model's formats
      // array is a separate structured guess, generated independently of
      // whatever plain-text summary it may have said elsewhere in the same
      // conversation. Left unchecked, this is exactly what let "Esto
      // entendí" show a format the client never actually asked for (or
      // silently drop one they did). When the client's own words carry an
      // explicit format signal, that signal — not the model's array —
      // decides what formats are real; the model's array is trusted as-is
      // only when the client's text names no format at all (mezcla
      // recomendada, or an ambiguous mention the model reasonably read).
      const explicitFormats = detectExplicitFormatsFromConversation(history);
      const formats = explicitFormats
        ? modelFormats.filter((f) => explicitFormats.has(f)).length
          ? modelFormats.filter((f) => explicitFormats.has(f))
          : [...explicitFormats]
        : modelFormats;
      const frequencyPerWeek = Math.max(1, Math.min(7, Math.round(args.frequencyPerWeek ?? 3)));
      // CAMBIO 07 — bug real: the model's weekdays don't always match its
      // own frequencyPerWeek, so this always had to pad. The OLD pattern
      // ([1,3,5,0,2,4,6]) put Sunday fourth — ahead of Tuesday/Thursday/
      // Saturday — so a client who explicitly said "lunes a viernes" but
      // got a model reply with too few weekdays could silently have Sunday
      // padded back in. Two fixes, not just one: (1) the pattern below now
      // only ever reaches for a weekend day last, and (2) whenever the
      // client's own words carry an explicit day constraint, that
      // constraint — not the model's array, not the pattern — decides
      // which days are even eligible to pad from or survive in the first
      // place. See planning-constraints.server.ts.
      const explicitAllowed = detectAllowedWeekdaysFromConversation(history);
      const weekdayPattern: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
      const modelWeekdays = (args.weekdays ?? []).filter(
        (d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6,
      );
      const weekdaysSet = new Set(
        explicitAllowed ? modelWeekdays.filter((d) => explicitAllowed.has(d)) : modelWeekdays,
      );
      const padCandidates = explicitAllowed
        ? weekdayPattern.filter((d) => explicitAllowed.has(d))
        : weekdayPattern;
      for (const day of padCandidates) {
        if (weekdaysSet.size >= frequencyPerWeek) break;
        weekdaysSet.add(day);
      }
      const weekdays = [...weekdaysSet].slice(0, frequencyPerWeek);
      return {
        ok: true,
        kind: "done",
        brief: {
          objectives,
          otherObjective: args.otherObjective?.trim() || "",
          frequencyPerWeek,
          weekdays,
          formats,
          specialInfo: args.specialInfo?.trim() || "",
        },
      };
    } catch {
      return { ok: false, error: "respuesta_invalida" };
    }
  }

  let text = message.content?.trim();
  if (!text) return { ok: false, error: "sin_resultado" };
  // The system prompt asks for one short clarifying question when the
  // model doesn't call submit_planning_brief — but a real conversation
  // showed it ignoring that and writing out a full unsolicited campaign
  // pitch instead (ad copy, slogans, a list of pieces). That's not just
  // off-brief: the client's *next* message resends this whole history,
  // and /api/wit/planning-chat's schema caps each message at a few
  // thousand characters — a long enough reply there broke the entire
  // conversation with a generic "Wit no está disponible" error. Capping
  // it here guarantees that class of failure can't recur regardless of
  // whether the prompt tweak above holds up over time.
  const MAX_MESSAGE_TEXT = 480;
  if (text.length > MAX_MESSAGE_TEXT) {
    console.info("[wit-chat] planning brief text reply ran long, truncating", text.length);
    text = `${text.slice(0, MAX_MESSAGE_TEXT).trimEnd()}…`;
  }
  return { ok: true, kind: "message", text };
}
