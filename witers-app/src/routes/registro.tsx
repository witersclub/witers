import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { WitersLogo } from "../components/witers/brand";
import { FacebookSignInButton } from "../components/witers/facebook-signin-button";
import { GoogleSignInButton } from "../components/witers/google-signin-button";
import { PasswordInput } from "../components/witers/password-input";
import { useLanguage } from "../lib/i18n";
import { isPlanId } from "../lib/membership-plans";

export const Route = createFileRoute("/registro")({
  validateSearch: z.object({
    plan: z
      .string()
      .optional()
      .transform((v) => (isPlanId(v) ? v : undefined)),
  }),
  head: () => ({
    meta: [
      { title: "Crear cuenta. WITERS" },
      { name: "description", content: "Crea tu cuenta WITERS y únete a la comunidad del ingenio." },
    ],
  }),
  component: Registro,
});

function Registro() {
  const { plan } = Route.useSearch();
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set once registration succeeds — the account exists but stays locked
  // out until the client clicks the confirmation link (see verify-email.ts
  // and migration 0030), so there's no session to send them into /checkout
  // with anymore. Holding the email here (rather than just a boolean) is
  // what lets the "reenviar" button below work without asking them to
  // retype it.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, plan }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; email?: string };
      if (!data.ok) {
        setError(
          data.error === "correo_registrado"
            ? t(
                "Ese correo ya tiene una cuenta. Intenta ingresar.",
                "That email already has an account. Try logging in instead.",
              )
            : t(
                "Revisa tus datos: nombre, correo válido y contraseña de al menos 8 caracteres.",
                "Check your details: name, a valid email, and a password of at least 8 characters.",
              ),
        );
        return;
      }
      setSentTo(data.email ?? form.email);
    } catch {
      setError(
        t(
          "No pudimos crear tu cuenta. Intenta de nuevo.",
          "We couldn't create your account. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!sentTo) return;
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: sentTo }),
      });
      setResent(true);
    } finally {
      setResending(false);
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
        {sentTo ? (
          <>
            <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
              {t("Revisa tu", "Check your")}{" "}
              <span className="wit-underline text-wit-blue">{t("correo", "email")}</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-wit-gray">
              {t("Te mandamos un enlace de confirmación a ", "We sent a confirmation link to ")}
              <strong className="text-wit-ink">{sentTo}</strong>
              {t(
                ". Ábrelo para activar tu cuenta — si el correo está mal escrito, no te va a llegar nada, así que revisa que sea el correcto.",
                ". Open it to activate your account — if the email has a typo, nothing will arrive, so double-check it's the right one.",
              )}
            </p>
            <button
              type="button"
              disabled={resending}
              onClick={resendVerification}
              className="mt-6 w-full rounded-xl border border-wit-ink/15 bg-white px-6 py-3.5 text-base font-bold text-wit-ink transition-colors hover:bg-wit-mist/40 disabled:opacity-60"
            >
              {resending
                ? t("Enviando...", "Sending...")
                : resent
                  ? t("Correo reenviado ✓", "Email resent ✓")
                  : t("Reenviar correo de confirmación", "Resend confirmation email")}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
              {t("Crea tu", "Create your")}{" "}
              <span className="wit-underline text-wit-blue">{t("cuenta", "account")}</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-wit-gray">
              {t(
                "Da el primer paso: crea tu cuenta y activa tu membresía para entrar a la comunidad del",
                "Take the first step: create your account and activate your membership to join the community of",
              )}{" "}
              <strong className="text-wit-blue">{t("ingenio", "ingenuity")}</strong>.
            </p>

            <form onSubmit={submit} className="mt-9 space-y-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                  {t("Nombre completo", "Full name")}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
                  placeholder="Ana Martínez"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                  {t("Correo electrónico", "Email address")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
                  placeholder="tu@correo.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold text-wit-ink"
                >
                  {t("Contraseña", "Password")}
                </label>
                <PasswordInput
                  id="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={t("Mínimo 8 caracteres", "Minimum 8 characters")}
                />
              </div>

              <label htmlFor="terms" className="flex items-start gap-3 text-sm text-wit-gray">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-wit-ink/25 text-wit-blue accent-[#0047ff]"
                />
                <span>
                  {t("Acepto los", "I accept the")}{" "}
                  <Link
                    to="/terminos"
                    target="_blank"
                    className="font-semibold text-wit-blue underline hover:text-wit-blue-deep"
                  >
                    {t("términos y condiciones", "terms and conditions")}
                  </Link>{" "}
                  {t("y el", "and the")}{" "}
                  <Link
                    to="/privacidad"
                    target="_blank"
                    className="font-semibold text-wit-blue underline hover:text-wit-blue-deep"
                  >
                    {t("aviso de privacidad", "privacy notice")}
                  </Link>{" "}
                  {t("de WITERS.", "of WITERS.")}
                </span>
              </label>

              {error ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading || !acceptedTerms}
                className="w-full rounded-xl bg-wit-blue px-6 py-3.5 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
              >
                {loading
                  ? t("Creando cuenta...", "Creating account...")
                  : t("Crear cuenta", "Create account")}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-wit-ink/10" />
                <span className="text-xs font-semibold text-wit-gray">{t("o", "or")}</span>
                <div className="h-px flex-1 bg-wit-ink/10" />
              </div>
              <div className="space-y-3">
                <GoogleSignInButton plan={plan} />
                <FacebookSignInButton plan={plan} />
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
