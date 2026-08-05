// Powers the panel's help chat (the blue chat-bubble button next to
// LanguageToggle) — a real ChatGPT conversation grounded in WITERS's own
// plans/policies plus the specific client's own account data, so it can
// answer "how does this work" AND "how many requests do I have left"
// accurately instead of guessing. Same OpenAI wiring shape as
// wit-chat.server.ts, but a separate, narrower system prompt: this one's
// job is answering questions, not collecting a design brief.
import process from "node:process";

import { MEMBERSHIP_PLANS } from "./membership-plans";

const OPENAI_TEXT_MODEL = "gpt-4o-mini";

export type HelpChatMessage = { role: "user" | "assistant"; content: string };

export type HelpUserContext = {
  companyName: string | null;
  membershipStatus: string | null;
  membershipPlan: string | null;
  requestsRemaining: number | null;
  videoRequestsRemaining: number | null;
  carouselRequestsRemaining: number | null;
};

export type HelpChatResult = { ok: true; text: string } | { ok: false; error: string };

function plansKnowledge(): string {
  return MEMBERSHIP_PLANS.map((p) => {
    const extras = [
      p.videoRequestsQuota > 0 ? `${p.videoRequestsQuota} videos/mes` : null,
      p.carouselRequestsQuota > 0 ? `${p.carouselRequestsQuota} carruseles/mes` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return (
      `- ${p.nombre}: $${p.precioPromo.toLocaleString("es-MX")} MXN/mes de promoción ` +
      `(regular $${p.precioRegular.toLocaleString("es-MX")} MXN/mes, ambos + IVA), ` +
      `${p.requestsQuota} solicitudes de diseño al mes` +
      (extras ? `, ${extras}` : "") +
      `. Beneficios: ${p.beneficios.join("; ")}.`
    );
  }).join("\n");
}

function buildSystemPrompt(user: HelpUserContext): string {
  const userLines = [
    user.companyName ? `Marca del cliente: ${user.companyName}.` : null,
    user.membershipPlan
      ? `Su plan actual: ${user.membershipPlan} (estado: ${user.membershipStatus ?? "desconocido"}).`
      : "Todavía no tiene una membresía activa.",
    user.requestsRemaining != null
      ? `Le quedan ${user.requestsRemaining} solicitudes de diseño este mes.`
      : null,
    user.videoRequestsRemaining != null && user.videoRequestsRemaining > 0
      ? `Le quedan ${user.videoRequestsRemaining} solicitudes de video este mes.`
      : null,
    user.carouselRequestsRemaining != null && user.carouselRequestsRemaining > 0
      ? `Le quedan ${user.carouselRequestsRemaining} solicitudes de carrusel este mes.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    "Eres el asistente de ayuda de WITERS, una agencia de branding por membresía con un panel " +
    "de cliente. Un miembro ya con sesión iniciada te está preguntando cómo funciona algo — " +
    "no estás creando una pieza de diseño ni recolectando un brief, solo respondes dudas. " +
    "Sé breve, claro y cálido (1-4 frases por respuesta). Responde siempre en el mismo idioma " +
    "en el que te escribe el cliente.\n\n" +
    "SOLO puedes responder con la información que tienes aquí abajo. Si la pregunta es sobre " +
    "algo que no sabes, que requiere una decisión especial (reembolsos, quejas, casos " +
    "particulares, cambios de contrato), o el cliente está molesto o pide explícitamente hablar " +
    "con una persona, dile con calidez que un miembro del equipo lo puede ayudar mejor con eso " +
    'y que puede darle clic al botón "Hablar con una persona" que está en esta misma ' +
    "conversación. Nunca inventes precios, políticas ni plazos que no estén aquí.\n\n" +
    "--- Planes de WITERS ---\n" +
    plansKnowledge() +
    "\n\n" +
    "--- Cómo funciona el servicio ---\n" +
    "- Las solicitudes de diseño se hacen platicando con Wit (el chat de creación) desde " +
    "'Creatividad' en el panel — no es un formulario, Wit hace preguntas y propone opciones.\n" +
    "- Cada solicitud incluye un número de revisiones según el plan (2 en Essential/Grow, 3 en " +
    "Scale) antes de generar un costo extra.\n" +
    "- Las cuotas (solicitudes, videos, carruseles) son mensuales y no se acumulan al mes " +
    "siguiente si no se usan.\n" +
    "- Una solicitud pasa por los estados: en proceso, completada (ya se puede ver/descargar) y " +
    "cerrada. Si algo salió mal en una pieza ya cerrada, se puede pedir un cambio desde el " +
    "detalle de esa pieza.\n" +
    "- Para pautar campañas de Meta, el cliente agrega a WITERS como socio (acceso Analyst) en " +
    "su propio Business Manager y le pasa a WITERS el ID de su cuenta publicitaria — WITERS " +
    "arma y da seguimiento a la campaña, el presupuesto de pauta lo cubre el cliente aparte.\n" +
    "- Las tipografías de marca se pueden subir como archivo o elegir de la librería de Google " +
    "Fonts, desde 'Mi marca'.\n" +
    "- La membresía se renueva automáticamente cada mes con el método de pago registrado. Se " +
    "puede cancelar en cualquier momento sin penalización, pero la cancelación aplica hasta " +
    "terminar el periodo ya pagado — no hay reembolsos parciales.\n" +
    "- El nombre de cuenta y la contraseña se cambian desde 'Mi perfil'.\n\n" +
    (userLines ? `--- Datos de este cliente ---\n${userLines}\n\n` : "") +
    "Termina cada respuesta lista para seguir la conversación si hace falta, sin despedirte " +
    "todavía."
  );
}

export async function runHelpChat(
  history: HelpChatMessage[],
  user: HelpUserContext,
): Promise<HelpChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "falta_openai_api_key" };

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
        temperature: 0.4,
        messages: [{ role: "system", content: buildSystemPrompt(user) }, ...history],
      }),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.info("[help-chat] openai failed", response.status, detail.slice(0, 500));
    return { ok: false, error: "openai_error" };
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "sin_resultado" };
  return { ok: true, text };
}
