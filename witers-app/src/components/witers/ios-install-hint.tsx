import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "wit_ios_install_hint_dismissed";

// Android/Chrome shows its own "Install app" prompt automatically once the
// manifest + service worker criteria are met — nothing to build there. iOS
// Safari never does: "Agregar a pantalla de inicio" only exists inside the
// share sheet, so people never find it unless we point it out. Only ever
// shown to iOS Safari visitors who haven't already installed the app and
// haven't dismissed this before.
function shouldOfferInstallHint(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(DISMISSED_KEY)) return false;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isStandalone) return false;

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldOfferInstallHint()) setVisible(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-2xl bg-wit-ink px-4 py-3.5 text-white shadow-[0_20px_50px_rgba(5,13,40,0.35)] sm:inset-x-auto sm:right-4 sm:w-96">
      <Share className="h-5 w-5 shrink-0 text-white/80" strokeWidth={2} />
      <p className="flex-1 text-sm leading-snug">
        Toca <span className="font-bold">compartir</span> y luego{" "}
        <span className="font-bold">&ldquo;Agregar a pantalla de inicio&rdquo;</span> para instalar
        WITERS como app.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 rounded-full p-1 text-white/60 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}
