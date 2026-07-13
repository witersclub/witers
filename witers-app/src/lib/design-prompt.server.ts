// Builds the actual prompt handed to OpenAI's image model from everything a
// client already told us — company, brief, style, audience, colors, promo
// text — so nobody has to hand-write or copy-paste a prompt anymore. Used
// both automatically (right after a client submits a request) and manually
// (a staff "Generar de nuevo" button), so the wording stays identical
// either way.

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
    parts.push(`Debe incluir textualmente este dato: "${input.requiredText}".`);

  parts.push(
    "Redacta tú el copy final del anuncio (texto en español, corto y persuasivo) a partir de esta información — el cliente no escribió el texto exacto, solo el contenido que debe comunicarse.",
  );
  parts.push(
    "Composición limpia, profesional y premium. Jerarquía visual clara, tipografía legible de alto contraste, iluminación de estudio, sin elementos genéricos de stock. Debe verse como una pieza real de campaña, no como una maqueta.",
  );
  parts.push(`Formato: ${RATIO_PROMPT[input.aspectRatio] ?? input.aspectRatio}.`);

  if (input.hasLogo) {
    parts.push(
      "La marca ya cuenta con logotipo propio — dale a la tipografía y a los colores un tratamiento acorde a una marca ya establecida, aunque el logo exacto no pueda insertarse en esta imagen.",
    );
  }

  return parts.join(" ");
}
