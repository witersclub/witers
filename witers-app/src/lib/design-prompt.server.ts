// Builds the raw, factual prompt from everything a client told us —
// company, brief, style, audience, colors, promo text, and which reference
// files they uploaded — so nobody has to hand-write one. This is only the
// input to polish-prompt.server.ts's ChatGPT call, not the final text a
// designer ever sees: it states facts plainly and leaves *how* to phrase
// and use them (e.g. what to do about an uploaded logo) to that call's
// system prompt, so that reasoning lives in one place instead of being
// duplicated per field here.

export type DesignPromptInput = {
  companyName: string | null;
  productName: string | null;
  pieceBrief: string | null;
  style: string | null;
  audience: string | null;
  ageRange: string | null;
  brandColors: string | null;
  promoPrice: string | null;
  requiredText: string | null;
  aspectRatio: string;
  hasLogo: boolean;
  hasProductPhoto: boolean;
  businessType: string | null;
};

const RATIO_PROMPT: Record<string, string> = {
  "1:1": "formato cuadrado 1:1",
  "4:3": "formato horizontal 4:3",
  "16:9": "formato horizontal 16:9 (banner)",
  "3:4": "formato vertical 3:4 (feed)",
  "9:16": "formato vertical 9:16 (stories)",
};

export function buildDesignPrompt(input: DesignPromptInput): string {
  const parts: string[] = [
    "Eres un director de arte creando una pieza publicitaria digital de altísima calidad para una campaña real de una agencia de branding premium.",
  ];

  const business = [
    input.companyName ? `Marca: "${input.companyName}"` : null,
    input.productName ? `Producto o servicio destacado: "${input.productName}"` : null,
    input.businessType ? `Giro del negocio: ${input.businessType}` : null,
  ]
    .filter(Boolean)
    .join(". ");
  if (business) parts.push(business + ".");

  if (input.pieceBrief)
    parts.push(`Qué debe comunicar esta pieza en concreto: ${input.pieceBrief}.`);
  if (input.style) parts.push(`Estilo visual: ${input.style}.`);

  const audience = [
    input.audience ? `Público objetivo: ${input.audience}` : null,
    input.ageRange ? `rango de edad: ${input.ageRange}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (audience) parts.push(audience + ".");

  if (input.brandColors)
    parts.push(`Usa esta paleta de colores de marca de forma consistente: ${input.brandColors}.`);
  if (input.promoPrice) parts.push(`Destaca este precio o promoción: "${input.promoPrice}".`);
  if (input.requiredText)
    // Respuesta cruda del cliente, tal como la escribió — puede venir
    // coloquial ("sí, de 12,000 a 5,999"). No se le dice a la IA que la
    // trate como texto literal a propósito: polish-prompt.server.ts es
    // quien decide qué extraer y qué es muletilla desechable.
    parts.push(
      `Otro dato que el cliente pidió que apareciera en la pieza: "${input.requiredText}".`,
    );

  parts.push(
    "Redacta tú el copy final del anuncio (texto en español, corto y persuasivo) a partir de esta información — el cliente no escribió el texto exacto, solo el contenido que debe comunicarse.",
  );
  parts.push(
    "Composición limpia, profesional y premium. Jerarquía visual clara, tipografía legible de alto contraste, iluminación de estudio, sin elementos genéricos de stock. Debe verse como una pieza real de campaña, no como una maqueta.",
  );
  parts.push(`Formato: ${RATIO_PROMPT[input.aspectRatio] ?? input.aspectRatio}.`);

  if (input.hasLogo) parts.push("El cliente ya cuenta con un logotipo oficial de marca.");
  if (input.hasProductPhoto)
    parts.push("El cliente proporcionó una foto de referencia del producto.");

  return parts.join(" ");
}
