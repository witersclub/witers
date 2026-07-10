import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";

export const Route = createFileRoute("/witer")({
  head: () => ({
    meta: [
      { title: "Diseñadores. WITERS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignerPanel,
});

type ResultItem = { id: string; kind: string; image_url: string | null; r2_key: string | null };

type DesignerRequest = {
  id: string;
  title: string;
  brief: string;
  style: string | null;
  aspect_ratio: string;
  audience: string | null;
  age_range: string | null;
  required_text: string | null;
  brand_colors: string | null;
  promo_price: string | null;
  reference_key: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  claimed_by: string | null;
  claimed_by_name: string | null;
  results_json: string | null;
};

const RATIO_PROMPT: Record<string, string> = {
  "1:1": "formato cuadrado 1:1 (feed)",
  "4:3": "formato horizontal 4:3",
  "16:9": "formato horizontal 16:9 (banner)",
  "3:4": "formato vertical 3:4",
  "9:16": "formato vertical 9:16 (stories)",
};

function useStaffUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      if (!body.ok || (body.user?.role !== "admin" && body.user?.role !== "designer")) return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

function DesignerPanel() {
  const platform = useStaffUser();
  const overview = useQuery({
    queryKey: ["designer-requests"],
    queryFn: async () => {
      const res = await fetch("/api/designer/requests", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as { ok: boolean; requests: DesignerRequest[]; me: string };
    },
    enabled: Boolean(platform.data),
    refetchInterval: 20_000,
  });

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
          El panel de diseñadores requiere una cuenta de diseñador o administrador. Inicia sesión y
          vuelve a esta página.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/ingresar";
          }}
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión
        </button>
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="wit-page min-h-dvh">
      <header className="border-b border-wit-ink/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/">
              <WitersLogo compact />
            </Link>
            <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
              DISEÑADORES
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(
                () => {
                  window.location.href = "/";
                },
              );
            }}
            className="wit-navlink text-sm font-medium text-wit-ink"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink">
          Solicitudes de <span className="text-wit-blue">diseño</span>
        </h1>
        <p className="mt-2 text-sm text-wit-gray">
          Toma una solicitud para trabajarla — así nadie más la duplica.
        </p>

        {overview.isLoading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : !data?.ok ? (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            No pudimos cargar las solicitudes.
          </p>
        ) : data.requests.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-wit-ink/15 bg-white/60 p-10 text-center">
            <p className="text-base font-semibold text-wit-ink">No hay solicitudes todavía.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {data.requests.map((r) => (
              <DesignerRequestCard key={r.id} row={r} me={data.me} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DesignerRequestCard({ row, me }: { row: DesignerRequest; me: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState(row.admin_note ?? "");

  const results = (() => {
    if (!row.results_json) return [] as ResultItem[];
    try {
      return (JSON.parse(row.results_json) as ResultItem[]).filter(
        (x) => x && x.kind !== "draft" && (x.image_url || x.r2_key),
      );
    } catch {
      return [];
    }
  })();

  const mine = row.claimed_by === me;
  const claimed = Boolean(row.claimed_by);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["designer-requests"] });
  }

  async function claim() {
    setBusy("claim");
    setMsg(null);
    try {
      const res = await fetch("/api/designer/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) setMsg("Alguien más la acaba de tomar.");
      await refresh();
    } catch {
      setMsg("No pudimos tomarla. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function copyInfo() {
    const style = row.style ? ` Estilo: ${row.style}.` : "";
    const audience = row.audience
      ? ` Dirigido a: ${row.audience}${row.age_range ? ` (${row.age_range} años)` : ""}.`
      : row.age_range
        ? ` Dirigido a personas de ${row.age_range} años.`
        : "";
    const promo = row.promo_price ? ` Precio/descuento a destacar: ${row.promo_price}.` : "";
    const requiredText = row.required_text ? ` Dato extra del cliente: "${row.required_text}".` : "";
    const colors = row.brand_colors ? ` Paleta de colores de marca: ${row.brand_colors}.` : "";
    const ratio = RATIO_PROMPT[row.aspect_ratio] ?? row.aspect_ratio;
    const reference = row.reference_key
      ? " El cliente adjuntó un logo/imagen de referencia — descárgala abajo y súbela junto con este prompt si tu herramienta de IA lo permite."
      : "";
    const prompt = `Creatividad publicitaria profesional de alta calidad. ${row.brief}${style}${audience}${promo}${requiredText}${colors} Redacta tú el texto final del anuncio a partir de estos datos (el cliente no escribió el copy). Composición limpia y premium, tipografía legible, colores de marca consistentes, luz de estudio. Usa ${ratio}.${reference}`;
    try {
      await navigator.clipboard.writeText(prompt);
      setMsg("Prompt copiado al portapapeles.");
    } catch {
      setMsg("No pudimos copiar. Selecciona el texto manualmente.");
    }
  }

  async function deliver() {
    if (!file) return;
    setBusy("deliver");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", row.id);
      const res = await fetch("/api/admin/deliver", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: boolean };
      setMsg(data.ok ? "Archivo entregado al cliente." : "No pudimos subir el archivo.");
      setFile(null);
      await refresh();
    } catch {
      setMsg("No pudimos subir el archivo.");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: string) {
    setBusy("status");
    setMsg(null);
    try {
      await fetch("/api/admin/update-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id, status, adminNote: note || undefined }),
      });
      await refresh();
      setMsg("Solicitud actualizada.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-wit-ink">{row.title}</h3>
          <p className="mt-0.5 text-xs text-wit-gray">
            {row.aspect_ratio}
            {row.style ? ` · ${row.style}` : ""} ·{" "}
            {new Date(row.created_at + "Z").toLocaleString("es-MX")}
          </p>
          <p className="mt-1 text-xs font-semibold">
            {claimed ? (
              <span className={mine ? "text-wit-blue" : "text-wit-gray"}>
                {mine ? "Tomada por ti" : `Tomada por ${row.claimed_by_name}`}
              </span>
            ) : (
              <span className="text-amber-600">Sin tomar</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyInfo}
            className="rounded-full border border-wit-ink/15 px-3 py-1.5 text-xs font-semibold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
          >
            Copiar prompt
          </button>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              row.status === "completada"
                ? "bg-emerald-50 text-emerald-700"
                : row.status === "rechazada"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {row.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-wit-gray">{row.brief}</p>

      {row.audience || row.age_range || row.required_text || row.brand_colors || row.promo_price ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-wit-ice p-4 text-sm sm:grid-cols-4">
          {row.audience ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">Público</dt>
              <dd className="mt-0.5 text-wit-ink">{row.audience}</dd>
            </div>
          ) : null}
          {row.age_range ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">Edad</dt>
              <dd className="mt-0.5 text-wit-ink">{row.age_range}</dd>
            </div>
          ) : null}
          {row.promo_price ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
                Precio/Descuento
              </dt>
              <dd className="mt-0.5 text-wit-ink">{row.promo_price}</dd>
            </div>
          ) : null}
          {row.required_text ? (
            <div className="col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
                Mensaje / dato extra del cliente
              </dt>
              <dd className="mt-0.5 text-wit-ink">{row.required_text}</dd>
            </div>
          ) : null}
          {row.brand_colors ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">Colores</dt>
              <dd className="mt-1 flex gap-1.5">
                {row.brand_colors.split(",").map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-full border border-wit-ink/10"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {row.reference_key ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-wit-ink/10 bg-white p-3">
          <a href={`/api/file?key=${encodeURIComponent(row.reference_key)}`} target="_blank" rel="noreferrer">
            <img
              src={`/api/file?key=${encodeURIComponent(row.reference_key)}`}
              alt="Referencia / logo del cliente"
              className="h-16 w-16 rounded-lg border border-wit-ink/10 object-cover"
              loading="lazy"
            />
          </a>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-wit-gray">
              Referencia del cliente
            </p>
            <a
              href={`/api/file?key=${encodeURIComponent(row.reference_key)}&download=1`}
              className="mt-0.5 inline-block text-sm font-semibold text-wit-blue underline-offset-2 hover:underline"
            >
              Descargar logo
            </a>
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {results.map((res) => {
            const href = res.image_url ?? `/api/file?key=${encodeURIComponent(res.r2_key ?? "")}`;
            return (
              <a key={res.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-wit-ink/10">
                <img src={href} alt="Resultado entregado" className="aspect-square w-full object-cover" loading="lazy" />
              </a>
            );
          })}
        </div>
      ) : null}

      {!claimed ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={claim}
          className="mt-5 w-full rounded-2xl bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
        >
          {busy === "claim" ? "Tomando..." : "Tomar solicitud"}
        </button>
      ) : !mine ? (
        <p className="mt-4 rounded-xl bg-wit-mist/40 px-4 py-2.5 text-sm text-wit-gray">
          Esta solicitud ya la tomó {row.claimed_by_name} — solo puede trabajarla y entregarla esa
          persona.
        </p>
      ) : (
        <>
          <div className="mt-5 rounded-xl bg-wit-ice p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-wit-ink">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <span className="rounded-full border border-wit-ink/20 px-4 py-2 hover:border-wit-blue">
                  {file ? file.name.slice(0, 24) : "Elegir archivo final"}
                </span>
              </label>
              {file ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={deliver}
                  className="rounded-full bg-wit-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue disabled:opacity-50"
                >
                  {busy === "deliver" ? "Subiendo..." : "Entregar archivo"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota para el cliente (opcional)"
              className="min-w-0 flex-1 rounded-lg border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setStatus("en_proceso")}
                className="rounded-full border border-wit-ink/20 px-4 py-2 text-xs font-bold text-wit-ink hover:border-wit-blue"
              >
                En proceso
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setStatus("completada")}
                className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
              >
                Completada
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setStatus("rechazada")}
                className="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Rechazada
              </button>
            </div>
          </div>
        </>
      )}

      {msg ? <p className="mt-3 rounded-lg bg-wit-mist/40 px-3 py-2 text-sm text-wit-ink">{msg}</p> : null}
    </article>
  );
}
