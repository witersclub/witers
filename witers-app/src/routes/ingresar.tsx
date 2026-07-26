import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { WitersLogo } from "../components/witers/brand";
import { FacebookSignInButton } from "../components/witers/facebook-signin-button";
import { GoogleSignInButton } from "../components/witers/google-signin-button";
import { PasswordInput } from "../components/witers/password-input";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/ingresar")({
  validateSearch: z.object({ error: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Ingresar. WITERS" },
      { name: "description", content: "Ingresa a tu cuenta WITERS." },
    ],
  }),
  component: Ingresar,
});

function Ingresar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { error: oauthError } = Route.useSearch();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(
    oauthError === "cuenta_dada_de_baja"
      ? t(
          "Esta cuenta fue dada de baja. Contacta a WITERS si crees que es un error.",
          "This account has been deactivated. Contact WITERS if you think this is a mistake.",
        )
      : oauthError === "facebook_sin_correo"
        ? t(
            "Tu cuenta de Facebook no compartió un correo. Autoriza el permiso de correo o ingresa con Google o tu contraseña.",
            "Your Facebook account didn't share an email. Allow the email permission, or sign in with Google or your password instead.",
          )
        : oauthError === "facebook"
          ? t(
              "No pudimos completar el acceso con Facebook. Intenta de nuevo.",
              "We couldn't complete Facebook sign-in. Please try again.",
            )
          : oauthError
            ? t(
                "No pudimos completar el acceso con Google. Intenta de nuevo.",
                "We couldn't complete Google sign-in. Please try again.",
              )
            : null,
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; user?: { role?: string } };
      if (!data.ok) {
        setError(
          data.error === "cuenta_dada_de_baja"
            ? t(
                "Esta cuenta fue dada de baja. Contacta a WITERS si crees que es un error.",
                "This account has been deactivated. Contact WITERS if you think this is a mistake.",
              )
            : t("Correo o contraseña incorrectos.", "Incorrect email or password."),
        );
        return;
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      // Staff accounts land in their own work panel, not the client one —
      // a designer login has no business seeing the membership/checkout UI.
      const dest =
        data.user?.role === "designer"
          ? "/witer"
          : data.user?.role === "admin"
            ? "/admin"
            : "/panel";
      navigate({ to: dest });
    } catch {
      setError(
        t(
          "No pudimos iniciar sesión. Intenta de nuevo.",
          "We couldn't sign you in. Please try again.",
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
        <Link to="/registro" className="wit-navlink text-sm font-medium text-wit-ink">
          {t("Crear cuenta", "Create account")}
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
          {t("Hola de nuevo,", "Welcome back,")}{" "}
          <span className="wit-underline text-wit-blue">Witer</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-wit-gray">
          {t(
            "Ingresa para dar seguimiento a tus solicitudes y crear nuevas creatividades.",
            "Log in to track your requests and create new creatives.",
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
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
              placeholder={t("tu@correo.com", "you@email.com")}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-wit-ink">
              {t("Contraseña", "Password")}
            </label>
            <PasswordInput
              id="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t("Tu contraseña", "Your password")}
            />
            <Link
              to="/olvide-contrasena"
              className="mt-1.5 inline-block text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
            >
              {t("¿Olvidaste tu contraseña?", "Forgot your password?")}
            </Link>
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-wit-blue px-6 py-3.5 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? t("Ingresando...", "Logging in...") : t("Ingresar", "Log in")}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-wit-ink/10" />
            <span className="text-xs font-semibold text-wit-gray">{t("o", "or")}</span>
            <div className="h-px flex-1 bg-wit-ink/10" />
          </div>
          <div className="space-y-3">
            <GoogleSignInButton />
            <FacebookSignInButton />
          </div>
        </form>
      </main>
    </div>
  );
}
