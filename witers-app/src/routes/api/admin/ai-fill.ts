import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import process from "node:process";

import { json, requireAdminUser } from "../../../lib/witers-auth.server";

const schema = z.object({
  transcript: z.string().min(5).max(4000),
});

// Admin-only sandbox: take a free-text brief (what a client would say out
// loud) and have OpenAI fill it into the exact fields NewRequestForm uses
// (see panel.tsx EMPTY_FORM). Nothing here touches design_requests — this
// only previews extraction quality before it's wired into the real form.
const OPENAI_MODEL = "gpt-4o-mini";

const STYLE_CHIPS = ["Minimalista", "Premium / Elegante", "Colorido", "Corporativo", "Divertido / Bold"];
const AGE_CHIPS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const ASPECT_RATIOS = ["1:1", "4:3", "16:9", "3:4", "9:16"];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título corto de la pieza, ej. 'Anuncio de lanzamiento para Instagram'." },
    companyName: { type: "string", description: "Nombre comercial o de la empresa." },
    productName: { type: "string", description: "Nombre del producto específico, o '' si no aplica." },
    brief: { type: "string", description: "A qué se dedica la empresa." },
    pieceBrief: { type: "string", description: "Qué debe mostrar/comunicar esta pieza en concreto." },
    style: {
      type: "string",
      description: `Estilo deseado. Usa una de estas opciones si claramente aplica: ${STYLE_CHIPS.join(", ")}. Si no, describe el estilo en pocas palabras, o '' si no se mencionó.`,
    },
    aspectRatio: {
      type: "string",
      enum: ASPECT_RATIOS,
      description: "Formato de la pieza. Si no se menciona, usa '1:1'.",
    },
    audience: { type: "string", description: "Público objetivo en palabras, o '' si no se mencionó." },
    ageRanges: {
      type: "array",
      items: { type: "string", enum: AGE_CHIPS },
      description: "Rangos de edad del público que apliquen, o arreglo vacío si no se mencionó.",
    },
    promoPrice: { type: "string", description: "Precio o descuento a destacar, o '' si no aplica." },
    requiredText: { type: "string", description: "Texto/dato obligatorio a incluir en la pieza, o '' si no aplica." },
    colors: {
      type: "array",
      items: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
      description: "Hasta 3 colores de marca en hexadecimal, solo si el cliente los mencionó explícitamente.",
    },
    missingInfo: {
      type: "array",
      items: { type: "string" },
      description: "En español, lista breve de qué información importante falta o quedó ambigua (para preguntarle al cliente). Arreglo vacío si el brief está completo.",
    },
  },
  required: [
    "title",
    "companyName",
    "productName",
    "brief",
    "pieceBrief",
    "style",
    "aspectRatio",
    "audience",
    "ageRanges",
    "promoPrice",
    "requiredText",
    "colors",
    "missingInfo",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Eres el asistente de intake de WITERS, un servicio de diseño gráfico por membresía. Un cliente describe en sus propias palabras (a veces por voz, transcrito) la pieza publicitaria que necesita. Tu trabajo es extraer esa descripción hacia un formato de campos fijo, EN ESPAÑOL, sin inventar datos que el cliente no mencionó — deja esos campos vacíos ('' o []) en vez de adivinar. No traduzcas ni cambies el tono de lo que el cliente escribió, solo organízalo en los campos.`;

export const Route = createFileRoute("/api/admin/ai-fill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (!auth.ok) return json(auth.body, { status: auth.status });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return json({ ok: false, error: "falta_openai_api_key" }, { status: 500 });
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

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
              model: OPENAI_MODEL,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: parsed.data.transcript },
              ],
              response_format: {
                type: "json_schema",
                json_schema: { name: "design_request_fields", strict: true, schema: RESPONSE_SCHEMA },
              },
            }),
          });
        } catch {
          return json({ ok: false, error: "tiempo_agotado" }, { status: 504 });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.info("[api/admin/ai-fill] openai failed", response.status, detail.slice(0, 500));
          return json({ ok: false, error: "openai_error" }, { status: 502 });
        }

        type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };
        const body = (await response.json()) as OpenAiResponse;
        const content = body.choices?.[0]?.message?.content;
        if (!content) {
          return json({ ok: false, error: "sin_resultado" }, { status: 502 });
        }

        try {
          const fields = JSON.parse(content);
          return json({ ok: true, fields });
        } catch {
          return json({ ok: false, error: "respuesta_invalida" }, { status: 502 });
        }
      },
    },
  },
});
