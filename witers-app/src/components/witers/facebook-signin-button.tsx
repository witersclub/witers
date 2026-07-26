import { useLanguage } from "../../lib/i18n";

// Official Facebook "f" mark, single brand blue circle — Meta's brand
// guidelines for "Continue with Facebook" buttons call for this exact
// icon, not a generic lucide icon.
function FacebookF() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M48 24C48 10.7 37.3 0 24 0S0 10.7 0 24c0 12 8.8 22 20.2 23.8V30.9h-6.1V24h6.1v-5.3c0-6 3.6-9.3 9-9.3 2.6 0 5.3.5 5.3.5v5.9h-3c-3 0-3.9 1.9-3.9 3.7V24h6.6l-1.1 6.9h-5.6v16.9C39.2 46 48 36 48 24z"
      />
      <path
        fill="#fff"
        d="M33.3 30.9 34.4 24h-6.6v-4.5c0-1.9.9-3.7 3.9-3.7h3v-5.9s-2.7-.5-5.3-.5c-5.4 0-9 3.3-9 9.3V24h-6.1v6.9h6.1v16.9c1.2.2 2.5.3 3.8.3s2.6-.1 3.8-.3V30.9h5.6z"
      />
    </svg>
  );
}

// Plain browser redirect (not a fetch call) — /api/auth/facebook/start
// 302s straight to Facebook's consent screen, so this is an <a>, not a
// button+onClick. `plan` only ever comes from /registro?plan=... and rides
// through the OAuth round trip the same way registro.tsx passes it to
// /checkout after a normal signup.
export function FacebookSignInButton({ plan }: { plan?: string }) {
  const { t } = useLanguage();
  const href = plan
    ? `/api/auth/facebook/start?plan=${encodeURIComponent(plan)}`
    : "/api/auth/facebook/start";
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-wit-ink/15 bg-white px-6 py-3.5 text-base font-bold text-wit-ink transition-colors hover:bg-wit-mist/40"
    >
      <FacebookF />
      {t("Continuar con Facebook", "Continue with Facebook")}
    </a>
  );
}
