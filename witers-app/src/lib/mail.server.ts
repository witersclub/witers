// Server-only helper to send transactional email via Resend. Requires the
// RESEND_API_KEY secret (Runtime environment → Variables y secretos). Fails
// silently (logs only) so an email hiccup never blocks a status update.
import process from "node:process";

const FROM = "WITERS <notificaciones@witers.com>";

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("[mail] sin RESEND_API_KEY, se omite envio", { to: opts.to, subject: opts.subject });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      console.error("[mail] resend error", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[mail] fetch error", err);
  }
}

export function requestCompletedEmail(opts: { title: string; requestUrl: string }): { subject: string; html: string } {
  return {
    subject: "Tu solicitud de diseño ya está lista",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">¡Tu diseño está listo!</h2>
        <p>Hola,</p>
        <p>Tu solicitud <strong>"${escapeHtml(opts.title)}"</strong> ya fue completada por nuestro equipo.</p>
        <p>Ingresa a tu panel de WITERS para revisarla, descargarla, o solicitar un cambio si algo no quedó como esperabas.</p>
        <p style="margin: 24px 0;">
          <a href="${opts.requestUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver mi solicitud
          </a>
        </p>
        <p style="color:#666;font-size:13px;">— El equipo de WITERS</p>
      </div>
    `,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
