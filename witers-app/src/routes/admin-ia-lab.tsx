import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";

export const Route = createFileRoute("/admin-ia-lab")({
  head: () => ({
    meta: [
      { title: "Laboratorio IA. WITERS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AiLab,
});

type Fields = {
  title: string;
  companyName: string;
  productName: string;
  brief: string;
  pieceBrief: string;
  style: string;
  aspectRatio: string;
  audience: string;
  ageRanges: string[];
  promoPrice: string;
  requiredText: string;
  colors: string[];
  missingInfo: string[];
};

function usePlatformUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      if (!body.ok || body.user?.role !== "admin") return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

function AiLab() {
  const platform = usePlatformUser();
  const [transcript, setTranscript] = useState("");
  const [fields, setFields] = useState<Fields | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields(null);
    try {
      const res = await fetch("/api/admin/ai-fill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = (await res.json()) as { ok: boolean; fields?: Fields; error?: string };
      if (!data.ok || !data.fields) {
        setError(
          data.error === "falta_openai_api_key"
            ? "Falta configurar OPENAI_API_KEY en el Worker."
            : "No pudimos generar los campos. Intenta de nuevo.",
        );
        return;
      }
      setFields(data.fields);
    } catch {
      setError("No pudimos generar los campos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (platform.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!platform.data) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          Este laboratorio requiere una cuenta con rol de administrador.
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión de administrador
        </Link>
      </div>
    );
  }

  return (
    <div className="wit-page min-h-dvh">
      <header className="wit-glass border-b border-wit-ink/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/">
              <WitersLogo compact />
            </Link>
            <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
              LAB · SOLO ADMIN
            </span>
          </div>
          <Link to="/admin" className="wit-navlink text-sm font-medium text-wit-ink">
            ← Volver al panel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink">
          Laboratorio de <span className="text-wit-blue">relleno con IA</span>
        </h1>
        <p className="mt-2 text-sm text-wit-gray">
          Pega o escribe un brief como si fueras el cliente hablando. No crea ninguna solicitud
          real — solo muestra cómo la IA llenaría el formulario.
        </p>

        <form onSubmit={generate} className="wit-glass mt-6 rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
          <label htmlFor="transcript" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Brief del cliente
          </label>
          <textarea
            id="transcript"
            required
            minLength={5}
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Ej. Hola, tengo una cafetería que se llama Café Luna, vendemos café de especialidad. Quiero un anuncio para Instagram anunciando que tenemos 20% de descuento en frappés todo julio, algo colorido y divertido..."
            className="w-full resize-y rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 rounded-xl bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
          >
            {loading ? "Generando..." : "Generar"}
          </button>
          {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        </form>

        {fields ? (
          <div className="wit-glass mt-6 rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
            <h2 className="text-base font-bold text-wit-ink">Campos que llenó la IA</h2>
            <dl className="mt-4 space-y-4">
              <LabRow label="Título" value={fields.title} />
              <LabRow label="Nombre comercial / empresa" value={fields.companyName} />
              <LabRow label="Nombre del producto" value={fields.productName} />
              <LabRow label="A qué se dedica la empresa" value={fields.brief} />
              <LabRow label="Qué quieres que salga en esta pieza" value={fields.pieceBrief} />
              <LabRow label="Público objetivo" value={fields.audience} />
              <LabRow label="Rango de edad" value={fields.ageRanges.join(", ")} />
              <LabRow label="Precio o descuento" value={fields.promoPrice} />
              <LabRow label="Mensaje o dato extra" value={fields.requiredText} />
              <LabRow label="Estilo" value={fields.style} />
              <LabRow label="Formato" value={fields.aspectRatio} />
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
                  Colores de marca
                </dt>
                <dd className="mt-1.5 flex gap-2">
                  {fields.colors.length ? (
                    fields.colors.map((c) => (
                      <span
                        key={c}
                        className="h-7 w-7 rounded-full border border-wit-ink/10"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))
                  ) : (
                    <span className="text-sm text-wit-ink">—</span>
                  )}
                </dd>
              </div>
            </dl>

            {fields.missingInfo.length ? (
              <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                  Le faltó preguntar
                </p>
                <ul className="mt-1.5 list-inside list-disc text-sm text-amber-800">
                  {fields.missingInfo.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function LabRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-wit-ink">{value || "—"}</dd>
    </div>
  );
}
