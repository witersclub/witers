import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Activa tu membresía. WITERS" },
      { name: "description", content: "Activa tu membresía WITERS por $5,999 MXN al mes." },
    ],
  }),
  component: Checkout,
});

const BENEFICIOS = [
  "Acceso completo a la comunidad",
  "20 solicitudes de diseño con IA",
  "Panel personal de seguimiento",
  "Soporte y estrategia de marca",
];

function Checkout() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const active = me.data?.membership?.status === "active";

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = card.number.replace(/\s+/g, "");
    if (digits.length < 15 || digits.length > 16) {
      setError("Revisa el número de tarjeta.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardName: card.name, cardLast4: digits.slice(-4) }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        if (data.error === "no_sesion") {
          navigate({ to: "/ingresar" });
          return;
        }
        if (data.error === "ya_activa") {
          navigate({ to: "/panel" });
          return;
        }
        setError("No pudimos procesar el pago. Intenta de nuevo.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/panel" });
    } catch {
      setError("No pudimos procesar el pago. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (me.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!me.data?.ok) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          Para activar tu membresía primero crea tu cuenta o ingresa.
        </p>
        <div className="flex gap-3">
          <Link
            to="/registro"
            className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
          >
            Crear cuenta
          </Link>
          <Link
            to="/ingresar"
            className="rounded-full border border-wit-ink/15 px-6 py-3 text-sm font-semibold text-wit-ink hover:border-wit-blue"
          >
            Ingresar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wit-page min-h-dvh">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/">
          <WitersLogo />
        </Link>
        <Link to="/panel" className="wit-navlink text-sm font-medium text-wit-ink">
          Mi panel
        </Link>
      </div>

      <main className="mx-auto grid w-full max-w-4xl gap-10 px-5 pb-24 pt-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink">
            Activa tu <span className="wit-underline text-wit-blue">membresía</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-wit-gray">
            Activa tu suscripción y tu cuenta queda lista para pedir creatividades con IA.
          </p>

          <div className="mt-8 rounded-3xl bg-wit-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/70">
              Membresía WITERS
            </p>
            <p className="mt-3 font-wit-mono text-5xl font-semibold">$5,999</p>
            <p className="mt-1 text-sm text-white/75">MXN al mes</p>
            <ul className="mt-6 space-y-3">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-white/90">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="#7da2ff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                  >
                    <path d="M3.5 10.5 8 15l8.5-9.5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          {active ? (
            <div className="rounded-3xl border border-wit-blue/20 bg-white p-8 text-center">
              <p className="text-lg font-bold text-wit-ink">Tu membresía ya está activa.</p>
              <Link
                to="/panel"
                className="mt-5 inline-block rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
              >
                Ir a mi panel
              </Link>
            </div>
          ) : (
            <form
              onSubmit={pay}
              className="rounded-3xl bg-white p-8 shadow-[0_20px_60px_rgba(5,13,40,0.08)]"
            >
              <h2 className="text-xl font-bold text-wit-ink">Datos de pago</h2>
              <p className="mt-1 text-xs text-wit-gray">
                Pago seguro con tarjeta de crédito o débito.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="cname"
                    className="mb-1.5 block text-sm font-semibold text-wit-ink"
                  >
                    Nombre en la tarjeta
                  </label>
                  <input
                    id="cname"
                    type="text"
                    required
                    minLength={2}
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                    className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
                    placeholder="Como aparece en la tarjeta"
                  />
                </div>
                <div>
                  <label htmlFor="cnum" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                    Número de tarjeta
                  </label>
                  <input
                    id="cnum"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    required
                    value={card.number}
                    onChange={(e) =>
                      setCard({
                        ...card,
                        number: e.target.value
                          .replace(/[^\d]/g, "")
                          .replace(/(\d{4})(?=\d)/g, "$1 ")
                          .slice(0, 19),
                      })
                    }
                    className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 font-wit-mono text-base outline-none focus:border-wit-blue"
                    placeholder="4242 4242 4242 4242"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cexp"
                      className="mb-1.5 block text-sm font-semibold text-wit-ink"
                    >
                      Vencimiento
                    </label>
                    <input
                      id="cexp"
                      type="text"
                      required
                      value={card.exp}
                      onChange={(e) =>
                        setCard({
                          ...card,
                          exp: e.target.value
                            .replace(/[^\d]/g, "")
                            .replace(/(\d{2})(?=\d)/, "$1/")
                            .slice(0, 5),
                        })
                      }
                      className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 font-wit-mono text-base outline-none focus:border-wit-blue"
                      placeholder="MM/AA"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ccvc"
                      className="mb-1.5 block text-sm font-semibold text-wit-ink"
                    >
                      CVC
                    </label>
                    <input
                      id="ccvc"
                      type="password"
                      required
                      value={card.cvc}
                      onChange={(e) =>
                        setCard({ ...card, cvc: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })
                      }
                      className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 font-wit-mono text-base outline-none focus:border-wit-blue"
                      placeholder="123"
                    />
                  </div>
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-wit-blue px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "Procesando pago..." : "Pagar $5,999 MXN"}
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-wit-gray">
                Entorno de pago en modo de activación directa. La pasarela definitiva (Stripe o
                Mercado Pago) se conecta sin cambiar este flujo.
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
