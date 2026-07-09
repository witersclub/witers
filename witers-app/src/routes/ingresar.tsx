import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";

export const Route = createFileRoute("/ingresar")({
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
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
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
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError("Correo o contraseña incorrectos.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/panel" });
    } catch {
      setError("No pudimos iniciar sesión. Intenta de nuevo.");
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
          Crear cuenta
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
          Hola de nuevo, <span className="wit-underline text-wit-blue">Witer</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-wit-gray">
          Ingresa para dar seguimiento a tus solicitudes y crear nuevas creatividades.
        </p>

        <form onSubmit={submit} className="mt-9 space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-wit-ink">
              Correo electrónico
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
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
              placeholder="Tu contraseña"
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
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </main>
    </div>
  );
}

