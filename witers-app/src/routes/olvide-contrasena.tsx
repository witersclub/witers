import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/olvide-contrasena")({
  head: () => ({
    meta: [{ title: "Recuperar contraseña. WITERS" }],
  }),
  component: OlvideContrasena,
});

function OlvideContrasena() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always shown, regardless of whether that email has an account —
      // see forgot-password.ts for why.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wit-page flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/">
          <WitersLogo />
        </Link>
        <Link to="/ingresar" className="wit-navlink text-sm font-medium text-wit-ink">
          {t("Ingresar", "Log in")}
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
          {t("Recupera tu", "Recover your")}{" "}
          <span className="wit-underline text-wit-blue">{t("contraseña", "password")}</span>
        </h1>

        {sent ? (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {t(
              "Si ese correo tiene una cuenta con nosotros, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y spam).",
              "If that email has an account with us, we sent a password reset link. Check your inbox (and spam).",
            )}
          </p>
        ) : (
          <>
            <p className="mt-4 text-base leading-relaxed text-wit-gray">
              {t(
                "Escribe el correo de tu cuenta y te enviamos un enlace para elegir una nueva contraseña.",
                "Enter your account's email and we'll send you a link to choose a new password.",
              )}
            </p>
            <form onSubmit={submit} className="mt-9 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                  {t("Correo electrónico", "Email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
                  placeholder={t("tu@correo.com", "you@email.com")}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-wit-blue px-6 py-3.5 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? t("Enviando...", "Sending...") : t("Enviar enlace", "Send reset link")}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
