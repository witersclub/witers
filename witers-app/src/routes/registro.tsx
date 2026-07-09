import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";

export const Route = createFileRoute("/registro")({
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
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
            ? "Ese correo ya tiene una cuenta. Intenta ingresar."
            : "Revisa tus datos: nombre, correo válido y contraseña de al menos 8 caracteres.",
        );
        return;
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/checkout" });
    } catch {
      setError("No pudimos crear tu cuenta. Intenta de nuevo.");
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
          Ingresar
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
          Crea tu <span className="wit-underline text-wit-blue">cuenta</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-wit-gray">
          Da el primer paso: crea tu cuenta y activa tu membresía para entrar a la comunidad del{" "}
          <strong className="text-wit-blue">ingenio</strong>.
        </p>

        <form onSubmit={submit} className="mt-9 space-y-5">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-wit-ink">
              Nombre completo
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
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
              placeholder="Mínimo 8 caracteres"
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
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
          <p className="text-center text-xs text-wit-gray">
            El acceso con Google estará disponible próximamente.
          </p>
        </form>
      </main>
    </div>
  );
}

