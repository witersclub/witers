import { useLanguage } from "../../lib/i18n";

// Official four-color "G" mark — Google's brand guidelines for "Sign in
// with Google" buttons call for this exact icon, not a generic lucide icon.
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2v6h7.6c4.4-4.1 7-10.1 7-17.7z"
      />
      <path
        fill="#34A853"
        d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.6-6c-2.1 1.4-4.9 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.4v6.2C6.4 41.6 14.5 47 24 47z"
      />
      <path
        fill="#FBBC05"
        d="M10.3 27.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-6.2H2.4C.9 15.6 0 19.7 0 23c0 3.3.9 7.4 2.4 10.6l7.9-6.2z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.5 0 6.4 5.4 2.4 13.4l7.9 6.2C12.2 13.8 17.6 9.5 24 9.5z"
      />
    </svg>
  );
}

// Plain browser redirect (not a fetch call) — /api/auth/google/start
// 302s straight to Google's consent screen, so this is an <a>, not a
// button+onClick. `plan` only ever comes from /registro?plan=... and rides
// through the OAuth round trip the same way registro.tsx passes it to
// /checkout after a normal signup.
export function GoogleSignInButton({ plan }: { plan?: string }) {
  const { t } = useLanguage();
  const href = plan
    ? `/api/auth/google/start?plan=${encodeURIComponent(plan)}`
    : "/api/auth/google/start";
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-wit-ink/15 bg-white px-6 py-3.5 text-base font-bold text-wit-ink transition-colors hover:bg-wit-mist/40"
    >
      <GoogleG />
      {t("Continuar con Google", "Continue with Google")}
    </a>
  );
}
