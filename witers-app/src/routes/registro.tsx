import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan } = Route.useSearch();
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
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
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/checkout", search: plan ? { plan } : {} });
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
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-wit-ink">
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
      </main>
    </div>
  );
}
