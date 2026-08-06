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
  // Language the client actually talked to Wit in — the final piece's
  // on-image copy must match it, not default to Spanish just because the
  // rest of this template is written in Spanish. See polish-prompt.server.ts,
  // which is the step that actually enforces this on its output.
  lang: "es" | "en";
};

const RATIO_PROMPT: Record<string, Record<"es" | "en", string>> = {
  "1:1": { es: "formato cuadrado 1:1", en: "square format 1:1" },
  "4:3": { es: "formato horizontal 4:3", en: "horizontal format 4:3" },
  "16:9": { es: "formato horizontal 16:9 (banner)", en: "horizontal format 16:9 (banner)" },
  "3:4": { es: "formato vertical 3:4 (feed)", en: "vertical format 3:4 (feed)" },
  "9:16": { es: "formato vertical 9:16 (stories)", en: "vertical format 9:16 (stories)" },
};

export function buildDesignPrompt(input: DesignPromptInput): string {
  const en = input.lang === "en";
  const parts: string[] = [
    en
      ? "You are an art director creating a premium-quality digital ad piece for a real campaign at a premium branding agency."
      : "Eres un director de arte creando una pieza publicitaria digital de altísima calidad para una campaña real de una agencia de branding premium.",
  ];

  const business = [
    input.companyName
      ? en
        ? `Brand: "${input.companyName}"`
        : `Marca: "${input.companyName}"`
      : null,
    input.productName
      ? en
        ? `Featured product or service: "${input.productName}"`
        : `Producto o servicio destacado: "${input.productName}"`
      : null,
    input.businessType
      ? en
        ? `Business type: ${input.businessType}`
        : `Giro del negocio: ${input.businessType}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");
  if (business) parts.push(business + ".");

  if (input.pieceBrief)
    parts.push(
      en
        ? `What this piece must communicate specifically: ${input.pieceBrief}.`
        : `Qué debe comunicar esta pieza en concreto: ${input.pieceBrief}.`,
    );
  if (input.style)
    parts.push(en ? `Visual style: ${input.style}.` : `Estilo visual: ${input.style}.`);

  const audience = [
    input.audience
      ? en
        ? `Target audience: ${input.audience}`
        : `Público objetivo: ${input.audience}`
      : null,
    input.ageRange
      ? en
        ? `age range: ${input.ageRange}`
        : `rango de edad: ${input.ageRange}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (audience) parts.push(audience + ".");

  if (input.brandColors)
    parts.push(
      en
        ? `Use this brand color palette consistently: ${input.brandColors}.`
        : `Usa esta paleta de colores de marca de forma consistente: ${input.brandColors}.`,
    );
  // Always an explicit statement either way — never silence on price. A
  // missing line here reads as "not asked about," not "no price," which
  // an image-generating AI downstream can (and has) filled in with a
  // fabricated number. Spelling out "no price" removes that ambiguity
  // instead of leaving it to be inferred from an absent sentence.
  if (input.promoPrice) {
    parts.push(
      en
        ? `Feature this exact price or promotion, copied verbatim without changing a single digit or rounding it: "${input.promoPrice}".`
        : `Destaca este precio o promoción exacto, copiado tal cual sin cambiar un solo dígito ni redondearlo: "${input.promoPrice}".`,
    );
  } else {
    parts.push(
      en
        ? "The client did not provide any price, discount or promotion — this piece must NOT show any made-up price figure."
        : "El cliente no proporcionó ningún precio, descuento ni promoción — esta pieza NO debe mostrar ninguna cifra de precio inventada.",
    );
  }
  if (input.requiredText)
    // Respuesta cruda del cliente, tal como la escribió — puede venir
    // coloquial ("sí, de 12,000 a 5,999"). No se le dice a la IA que la
    // trate como texto literal a propósito: polish-prompt.server.ts es
    // quien decide qué extraer y qué es muletilla desechable.
    parts.push(
      en
        ? `Another detail the client asked to appear on the piece: "${input.requiredText}".`
        : `Otro dato que el cliente pidió que apareciera en la pieza: "${input.requiredText}".`,
    );

  parts.push(
    en
      ? "Write the ad's final copy yourself (short, persuasive text in English) from this information — the client did not write the exact wording, only the content that must be communicated."
      : "Redacta tú el copy final del anuncio (texto en español, corto y persuasivo) a partir de esta información — el cliente no escribió el texto exacto, solo el contenido que debe comunicarse.",
  );
  parts.push(
    en
      ? "Clean, professional, premium composition. Clear visual hierarchy, legible high-contrast typography, studio lighting, no generic stock elements. It must look like a real campaign piece, not a mockup."
      : "Composición limpia, profesional y premium. Jerarquía visual clara, tipografía legible de alto contraste, iluminación de estudio, sin elementos genéricos de stock. Debe verse como una pieza real de campaña, no como una maqueta.",
  );
  const ratioLabel = RATIO_PROMPT[input.aspectRatio]?.[input.lang] ?? input.aspectRatio;
  parts.push(en ? `Format: ${ratioLabel}.` : `Formato: ${ratioLabel}.`);

  if (input.hasLogo)
    parts.push(
      en
        ? "The client already has an official brand logo."
        : "El cliente ya cuenta con un logotipo oficial de marca.",
    );
  if (input.hasProductPhoto)
    parts.push(
      en
        ? "The client provided a reference photo of the product."
        : "El cliente proporcionó una foto de referencia del producto.",
    );

  return parts.join(" ");
}
