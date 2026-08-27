// Server-only helper to send transactional email via Resend. Requires the
// RESEND_API_KEY secret (Runtime environment → Variables y secretos). Fails
// silently (logs only) so an email hiccup never blocks a status update.
import process from "node:process";

const FROM = "WITERS <notificaciones@witers.com>";
const STAFF_EMAIL = "imawiter@gmail.com";

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("[mail] sin RESEND_API_KEY, se omite envio", {
      to: opts.to,
      subject: opts.subject,
    });
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

export function requestCompletedEmail(opts: { title: string; requestUrl: string }): {
  subject: string;
  html: string;
} {
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

// Staff-facing notifications (always to STAFF_EMAIL) — new request / revision.
export async function notifyStaffNewRequest(opts: {
  title: string;
  clientName: string;
  companyName: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Nueva solicitud: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Nueva solicitud de diseño</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> (${escapeHtml(opts.companyName)}) envió una nueva solicitud:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export async function notifyStaffRevisionRequested(opts: {
  title: string;
  clientName: string;
  message: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Solicitud de cambio: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Solicitud de cambio</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> pidió un ajuste en:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="background:#f2f5ff;border-radius:8px;padding:12px 16px;">${escapeHtml(opts.message)}</p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export async function notifyStaffChangeRequested(opts: {
  title: string;
  clientName: string;
  message: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Error reportado en pieza finalizada: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Error reportado en una pieza ya finalizada</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> reportó un error en una pieza que ya había marcado como correcta:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="background:#f2f5ff;border-radius:8px;padding:12px 16px;">${escapeHtml(opts.message)}</p>
        <p>Revisa la solicitud y actívala para que el equipo de diseño la retome.</p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export async function notifyStaffLowSatisfaction(opts: {
  title: string;
  clientName: string;
  rating: number;
  feedback: string | null;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Calificación ${opts.rating}/5: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Un cliente no quedó del todo satisfecho</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> calificó con <strong>${opts.rating}/5</strong>:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        ${opts.feedback ? `<p style="background:#f2f5ff;border-radius:8px;padding:12px 16px;">${escapeHtml(opts.feedback)}</p>` : ""}
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export function videoRequestCompletedEmail(opts: { title: string; requestUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Tu video ya está listo",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">¡Tu video está listo!</h2>
        <p>Hola,</p>
        <p>Tu solicitud de video <strong>"${escapeHtml(opts.title)}"</strong> ya fue editada por nuestro equipo.</p>
        <p>Ingresa a tu panel de WITERS para verla y descargarla.</p>
        <p style="margin: 24px 0;">
          <a href="${opts.requestUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver mi video
          </a>
        </p>
        <p style="color:#666;font-size:13px;">— El equipo de WITERS</p>
      </div>
    `,
  };
}

export async function notifyStaffNewVideoRequest(opts: {
  title: string;
  clientName: string;
  companyName: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Nueva solicitud de video: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Nueva solicitud de video</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> (${escapeHtml(opts.companyName)}) envió una nueva solicitud de video:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export async function notifyStaffNewCarouselRequest(opts: {
  title: string;
  clientName: string;
  companyName: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Nueva solicitud de carrusel: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Nueva solicitud de carrusel</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> (${escapeHtml(opts.companyName)}) envió una nueva solicitud de carrusel (4 láminas):</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export function carouselRequestCompletedEmail(opts: { title: string; requestUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Tu carrusel ya está listo",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">¡Tu carrusel está listo!</h2>
        <p>Hola,</p>
        <p>Las 4 láminas de tu carrusel <strong>"${escapeHtml(opts.title)}"</strong> ya fueron entregadas por nuestro equipo.</p>
        <p>Ingresa a tu panel de WITERS para revisarlas, descargarlas, o pedir un cambio en alguna lámina si algo no quedó como esperabas.</p>
        <p style="margin: 24px 0;">
          <a href="${opts.requestUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver mi carrusel
          </a>
        </p>
        <p style="color:#666;font-size:13px;">— El equipo de WITERS</p>
      </div>
    `,
  };
}

export async function notifyStaffVideoChangeRequested(opts: {
  title: string;
  clientName: string;
  message: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Cambio solicitado en video: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Cambio solicitado en un video</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> pidió un cambio en:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="background:#f2f5ff;border-radius:8px;padding:12px 16px;">${escapeHtml(opts.message)}</p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export async function notifyStaffCarouselChangeRequested(opts: {
  title: string;
  clientName: string;
  slideLabel: string;
  message: string;
  panelUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Cambio solicitado en carrusel: ${opts.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Cambio solicitado en un carrusel</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> pidió un cambio en <strong>${escapeHtml(opts.slideLabel)}</strong> de:</p>
        <p style="font-size:16px;"><strong>${escapeHtml(opts.title)}</strong></p>
        <p style="background:#f2f5ff;border-radius:8px;padding:12px 16px;">${escapeHtml(opts.message)}</p>
        <p style="margin: 24px 0;">
          <a href="${opts.panelUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver solicitud
          </a>
        </p>
      </div>
    `,
  });
}

export async function notifyStaffHelpEscalated(opts: {
  clientName: string;
  companyName: string;
  lastMessage: string;
  adminUrl: string;
}): Promise<void> {
  await sendMail({
    to: STAFF_EMAIL,
    subject: `Ayuda: ${opts.clientName} pidió hablar con una persona`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Un cliente pidió hablar con una persona</h2>
        <p><strong>${escapeHtml(opts.clientName)}</strong> (${escapeHtml(opts.companyName)}) escaló su chat de ayuda:</p>
        <p style="background:#f2f5ff;border-radius:8px;padding:12px 16px;">${escapeHtml(opts.lastMessage)}</p>
        <p style="margin: 24px 0;">
          <a href="${opts.adminUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Responder
          </a>
        </p>
      </div>
    `,
  });
}

export function passwordResetEmail(opts: { resetUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Restablece tu contraseña de WITERS",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Restablece tu contraseña</h2>
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta WITERS. Si fuiste tú, da clic abajo para elegir una nueva:</p>
        <p style="margin: 24px 0;">
          <a href="${opts.resetUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Elegir nueva contraseña
          </a>
        </p>
        <p style="color:#666;font-size:13px;">Este enlace expira en 1 hora. Si tú no lo pediste, puedes ignorar este correo — tu contraseña sigue siendo la misma.</p>
        <p style="color:#666;font-size:13px;">— El equipo de WITERS</p>
      </div>
    `,
  };
}

export function verifyEmailEmail(opts: { verifyUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Confirma tu correo en WITERS",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1450ff;">Confirma tu correo</h2>
        <p>Hola,</p>
        <p>Ya casi terminas de crear tu cuenta en WITERS. Da clic abajo para confirmar que este es tu correo:</p>
        <p style="margin: 24px 0;">
          <a href="${opts.verifyUrl}" style="background:#1450ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Confirmar mi correo
          </a>
        </p>
        <p style="color:#666;font-size:13px;">Este enlace expira en 24 horas. Si tú no creaste esta cuenta, puedes ignorar este correo.</p>
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
