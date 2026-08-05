import { useRouterState } from "@tanstack/react-router";

import { useLanguage } from "../../lib/i18n";

// +52 33 4321 1510, digits only — the format wa.me needs.
const WHATSAPP_NUMBER = "523343211510";

// Global floating "talk to a human on WhatsApp" button, mounted once in
// __root.tsx so it shows on every public page and inside the client panel
// without needing to be added to each route individually. Hidden on
// staff-only routes (/admin, /witer) — this is for prospects/clients
// reaching a real person, not internal tooling.
export function WhatsAppFloatButton() {
  const { t, lang } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname.startsWith("/admin") || pathname.startsWith("/witer")) return null;

  const message =
    lang === "en"
      ? "Hi, I have a question about WITERS."
      : "Hola, tengo una pregunta sobre WITERS.";
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  // The client panel's mobile bottom nav (PanelBottomNav, panel.tsx) spans
  // almost the full screen width near the bottom — this button needs real
  // clearance above it there, not just room beside it. That bar disappears
  // at sm: and up, so the extra offset only applies below that breakpoint.
  const isPanelRoute = pathname.startsWith("/panel");

  // Fire-and-forget — logged for the admin "Indicadores" tab. Never
  // awaited and never blocks/delays the link from opening WhatsApp.
  function trackClick() {
    fetch("/api/track-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "whatsapp_click", path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackClick}
      aria-label={t("Escríbenos por WhatsApp", "Message us on WhatsApp")}
      title={t("Escríbenos por WhatsApp", "Message us on WhatsApp")}
      className="fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition hover:brightness-105 active:scale-95 sm:right-6 sm:h-14 sm:w-14"
      style={{
        bottom: isPanelRoute
          ? "calc(6rem + env(safe-area-inset-bottom))"
          : "max(1.25rem, calc(env(safe-area-inset-bottom) + 1rem))",
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.33 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.78 1.22h.01c5.46 0 9.91-4.45 9.91-9.91a9.82 9.82 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.24.85 5.79 2.4a8.2 8.2 0 0 1 2.41 5.84c0 4.55-3.7 8.25-8.25 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.38c0-4.56 3.7-8.24 8.29-8.24ZM8.53 6.86c-.16 0-.42.06-.63.3-.22.24-.83.8-.83 1.94 0 1.15.85 2.26.97 2.42.12.16 1.65 2.52 4 3.53 1.98.85 2.38.68 2.81.64.43-.04 1.38-.56 1.57-1.1.2-.54.2-1 .14-1.1-.06-.09-.22-.15-.45-.27-.24-.12-1.38-.68-1.6-.76-.21-.08-.37-.11-.53.12-.15.23-.6.75-.74.9-.13.16-.27.18-.5.06-.24-.12-1-.36-1.9-1.16-.7-.62-1.17-1.39-1.31-1.63-.13-.23-.02-.35.1-.47.1-.11.24-.27.36-.41.12-.13.16-.23.24-.39.08-.15.04-.29-.02-.41-.06-.12-.53-1.28-.73-1.75-.19-.45-.39-.4-.53-.4Z" />
      </svg>
    </a>
  );
}
