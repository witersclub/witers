import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { WitersLogo } from "../components/witers/brand";
import { PasswordInput } from "../components/witers/password-input";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/restablecer-contrasena")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [{ title: "Restablecer contraseña. WITERS" }],
  }),
  component: RestablecerContrasena,
});

function RestablecerContrasena() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(
          t(
            "Este enlace ya no es válido — puede que haya expirado o ya se haya usado. Solicita uno nuevo.",
            "This link is no longer valid — it may have expired or already been used. Request a new one.",
          ),
        );
        return;
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/panel" });
    } catch {
      setError(
        t(
          "No pudimos restablecer tu contraseña. Intenta de nuevo.",
          "We couldn't reset your password. Please try again.",
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
          {t("Elige una nueva", "Choose a new")}{" "}
          <span className="wit-underline text-wit-blue">{t("contraseña", "password")}</span>
        </h1>

        {!token ? (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {t(
              "Este enlace no es válido. Solicita uno nuevo desde ",
              "This link isn't valid. Request a new one from ",
            )}
            <Link to="/olvide-contrasena" className="font-semibold underline">
              {t("aquí", "here")}
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="mt-9 space-y-5">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                {t("Nueva contraseña", "New password")}
              </label>
              <PasswordInput
                id="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("Mínimo 8 caracteres", "Minimum 8 characters")}
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-wit-blue px-6 py-3.5 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? t("Guardando...", "Saving...") : t("Guardar contraseña", "Save password")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
