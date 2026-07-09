import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import process from "node:process";

import { getSessionUser, json } from "../../lib/witers-auth.server";

const schema = z.object({
  input: z.string().min(5).max(800),
});

// Logged-in clients only: helps fill the design request form from a short
// free-text description. Text-only Gemini call (cheap, unlike image
// generation) — never used to produce the final deliverable, only to
// pre-fill fields the client can still review and edit.
const GEMINI_MODEL = "gemini-3.5-flash";

const STYLE_OPTIONS = ["Minimalista", "Premium / Elegante", "Colorido", "Corporativo", "Divertido / Bold"];
const AGE_OPTIONS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const RATIO_OPTIONS = ["1:1", "4:3", "16:9", "3:4", "9:16"];

const SYSTEM_PROMPT = `Ayudas a precompletar un formulario de solicitud de diseño publicitario a partir de una
descripción libre y corta que escribe un cliente. Responde SOLO con un objeto JSON (sin markdown, sin texto
extra) con estas claves exactas:
- "title": título corto para la solicitud, máx 60 caracteres.
- "brief": 1-3 frases describiendo el negocio, en español, basadas solo en lo que el cliente escribió.
- "audience": a quién le habla el anuncio, frase corta (vacío "" si no se puede inferir).
- "ageRange": cero o más de estas opciones separadas por coma, sin agregar otras: ${AGE_OPTIONS.join(", ")}. Vacío "" si no aplica.
- "style": exactamente una de estas opciones si aplica claramente, si no vacío "": ${STYLE_OPTIONS.join(", ")}.
- "requiredText": texto corto que debería llevar la imagen si el cliente lo mencionó (precio, promoción, CTA); vacío "" si no.
- "aspectRatio": la más probable entre exactamente estas: ${RATIO_OPTIONS.join(", ")}.
No inventes precios, contactos ni datos que el cliente no mencionó. Si algo no se puede inferir, deja el campo vacío.`;

type Suggestion = {
  title: string;
  brief: string;
  audience: string;
  ageRange: string;
  style: string;
  requiredText: string;
  aspectRatio: string;
};

export const Route = createFileRoute("/api/ai-autofill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return json({ ok: false, error: "no_sesion" }, { status: 401 });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return json({ ok: false, error: "falta_gemini_api_key" }, { status: 500 });
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return json({ ok: false, error: "datos_invalidos" }, { status: 400 });
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        let response: Response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
              method: "POST",
              signal: controller.signal,
              headers: {
                "content-type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nDescripción del cliente: ${parsed.data.input}` }] }],
                generationConfig: { responseMimeType: "application/json" },
              }),
            },
          );
        } catch {
          return json({ ok: false, error: "tiempo_agotado" }, { status: 504 });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.info("[api/ai-autofill] gemini failed", response.status, detail.slice(0, 500));
          return json({ ok: false, error: "gemini_error" }, { status: 502 });
        }

        type GeminiResponse = {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const body = (await response.json()) as GeminiResponse;
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return json({ ok: false, error: "sin_resultado" }, { status: 502 });

        let suggestion: Partial<Suggestion>;
        try {
          suggestion = JSON.parse(text) as Partial<Suggestion>;
        } catch {
          return json({ ok: false, error: "respuesta_invalida" }, { status: 502 });
        }

        // Only pass through values that actually match our known chip options,
        // so the UI never ends up in a state the client didn't choose from.
        const ageRange = (suggestion.ageRange ?? "")
          .split(",")
          .map((a) => a.trim())
          .filter((a) => AGE_OPTIONS.includes(a))
          .join(", ");
        const style = STYLE_OPTIONS.includes(suggestion.style ?? "") ? (suggestion.style as string) : "";
        const aspectRatio = RATIO_OPTIONS.includes(suggestion.aspectRatio ?? "")
          ? (suggestion.aspectRatio as string)
          : "1:1";

        return json({
          ok: true,
          suggestion: {
            title: (suggestion.title ?? "").slice(0, 120),
            brief: (suggestion.brief ?? "").slice(0, 4000),
            audience: (suggestion.audience ?? "").slice(0, 200),
            ageRange,
            style,
            requiredText: (suggestion.requiredText ?? "").slice(0, 500),
            aspectRatio,
          },
        });
      },
    },
  },
});
