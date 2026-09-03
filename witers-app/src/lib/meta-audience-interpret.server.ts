// Interprets a client's free-text description of who they want to reach
// ("dueños de restaurantes en CDMX, 28-50, interesados en emprendimiento")
// into structured fields — same OpenAI account/pattern as ad-copy.server.ts,
// a narrower prompt. This step ONLY extracts intent; it never invents a
// Meta location/interest id itself. The route that calls this
// (meta-audience-suggest.ts) takes the plain-text location/interest
// queries this returns and resolves them against Meta's own real search
// (searchMetaLocations/searchMetaInterests, meta-ads-create.server.ts) —
// see that file for why: an id guessed here could silently target nothing
// or the wrong audience, with no error from Meta at all.

import process from "node:process";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

export type AudienceInterpretation = {
  // Free text to feed into searchMetaLocations — a city/region name, not
  // an id. Null if the description didn't mention a place.
  locationQuery: string | null;
  ageMin: number | null;
  ageMax: number | null;
  // Free text keywords to feed into searchMetaInterests, one search per
  // entry — short, generic enough that Meta's interest taxonomy is likely
  // to have a match (e.g. "emprendimiento", not "quiere abrir su segundo
  // restaurante este año").
  interestQueries: string[];
  // A short, human-readable one-line summary of who this audience is, for
  // display in the preview card — never used to build any Meta field.
  notes: string | null;
};

export type AudienceInterpretResult =
  { ok: true; data: AudienceInterpretation } | { ok: false; error: string };

export async function interpretAudienceDescription(
  description: string,
): Promise<AudienceInterpretResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

  const systemPrompt =
    "Eres un estratega de medios pagados que traduce una descripción en lenguaje natural de " +
    "a quién quiere llegar un anunciante en una interpretación estructurada, para usarse " +
    "DESPUÉS contra el buscador real de ubicaciones e intereses de Meta Ads — tú NUNCA " +
    "generas IDs de Meta ni inventas nombres exactos de intereses; solo extraes la intención " +
    "en texto libre y corto para que otra búsqueda real la resuelva. " +
    "Reglas: locationQuery es el nombre de una ciudad/región mencionada (o null si no se " +
    "menciona ninguna) — nunca un país completo si se mencionó algo más específico. ageMin/" +
    "ageMax son números si se mencionó un rango de edad, o null si no. interestQueries es una " +
    "lista de 2 a 6 palabras clave CORTAS y GENÉRICAS (una o dos palabras cada una, en " +
    "español, sin adjetivos largos) que probablemente existan como intereses reales en Meta " +
    "— por ejemplo de 'dueños de restaurantes interesados en emprendimiento y gastronomía' " +
    "extraes algo como ['restaurantes','emprendimiento','gastronomía','pequeñas empresas'], " +
    "nunca frases completas. notes es una sola oración corta describiendo el objetivo de esa " +
    "audiencia (ej. 'Personas con alta afinidad con negocios de alimentos'), para mostrarse " +
    "tal cual al usuario. " +
    'Responde ÚNICAMENTE con un JSON válido de la forma {"locationQuery": "..." | null, ' +
    '"ageMin": number | null, "ageMax": number | null, "interestQueries": ["...", ...], ' +
    '"notes": "..." | null}, sin explicación ni texto adicional.';

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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description.slice(0, 2000) },
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
    console.info("[meta-audience-interpret] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> };
  const body = (await response.json()) as OpenAiResponse;
  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) return { ok: false, error: "sin_resultado" };

  try {
    const parsed = JSON.parse(raw) as {
      locationQuery?: unknown;
      ageMin?: unknown;
      ageMax?: unknown;
      interestQueries?: unknown;
      notes?: unknown;
    };
    const interestQueries = Array.isArray(parsed.interestQueries)
      ? parsed.interestQueries
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .slice(0, 6)
      : [];
    return {
      ok: true,
      data: {
        locationQuery:
          typeof parsed.locationQuery === "string" && parsed.locationQuery.trim()
            ? parsed.locationQuery.trim()
            : null,
        ageMin: typeof parsed.ageMin === "number" ? parsed.ageMin : null,
        ageMax: typeof parsed.ageMax === "number" ? parsed.ageMax : null,
        interestQueries,
        notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim() : null,
      },
    };
  } catch {
    return { ok: false, error: "respuesta_invalida" };
  }
}
