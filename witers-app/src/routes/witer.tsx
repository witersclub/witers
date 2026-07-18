import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { WitersLogo } from "../components/witers/brand";

export const Route = createFileRoute("/witer")({
  head: () => ({
    meta: [{ title: "Diseñadores. WITERS" }, { name: "robots", content: "noindex" }],
  }),
  component: DesignerPanel,
});

type ResultItem = { id: string; kind: string; image_url: string | null; r2_key: string | null };

type DesignerRequest = {
  id: string;
  title: string;
  company_name: string | null;
  product_name: string | null;
  brief: string;
  piece_brief: string | null;
  style: string | null;
  aspect_ratio: string;
  audience: string | null;
  age_range: string | null;
  required_text: string | null;
  brand_colors: string | null;
  promo_price: string | null;
  reference_key: string | null;
  logo_key: string | null;
  product_photo_key: string | null;
  status: string;
  admin_note: string | null;
  revisions_used: number;
  revision_note_1: string | null;
  revision_note_2: string | null;
  change_request_note: string | null;
  created_at: string;
  claimed_by: string | null;
  claimed_by_name: string | null;
  results_json: string | null;
  // ChatGPT-polished version of the prompt below — spelling/wording
  // cleaned up. Null until that background call finishes (or if it never
  // ran/failed), in which case copyInfo() falls back to building it locally.
  ai_prompt: string | null;
};

const RATIO_PROMPT: Record<string, string> = {
  "1:1": "formato cuadrado 1:1",
  "4:3": "formato horizontal 4:3",
  "16:9": "formato horizontal 16:9 (banner)",
  "3:4": "formato vertical 3:4 (feed)",
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
  const [tab, setTab] = useState<"en_proceso" | "en_revision" | "finalizadas">("en_proceso");
  // Lifted above the individual request cards: a card that just got sent
  // moves out of "En proceso" the instant the list refetches, which would
  // unmount a toast rendered inside it before the client ever saw it. Kept
  // here instead, at the panel level, so it survives that move.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
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
      <header className="wit-glass border-b border-wit-ink/10">
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
          <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
            <p className="text-base font-semibold text-wit-ink">No hay solicitudes todavía.</p>
          </div>
        ) : (
          (() => {
            const enProceso = data.requests.filter((r) => r.status === "en_proceso");
            const enRevision = data.requests.filter((r) => r.status === "completada");
            const finalizadas = data.requests.filter(
              (r) => r.status === "cerrada" || r.status === "rechazada",
            );
            const shown =
              tab === "en_proceso" ? enProceso : tab === "en_revision" ? enRevision : finalizadas;
            return (
              <>
                <div className="mt-8 flex gap-2 border-b border-wit-ink/10">
                  <DesignerTab
                    active={tab === "en_proceso"}
                    onClick={() => setTab("en_proceso")}
                    label="En proceso"
                    count={enProceso.length}
                  />
                  <DesignerTab
                    active={tab === "en_revision"}
                    onClick={() => setTab("en_revision")}
                    label="En revisión"
                    count={enRevision.length}
                  />
                  <DesignerTab
                    active={tab === "finalizadas"}
                    onClick={() => setTab("finalizadas")}
                    label="Finalizadas"
                    count={finalizadas.length}
                  />
                </div>

                {shown.length === 0 ? (
                  <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
                    <p className="text-base font-semibold text-wit-ink">
                      {tab === "en_proceso"
                        ? "No hay solicitudes en proceso."
                        : tab === "en_revision"
                          ? "No hay piezas en revisión del cliente."
                          : "Aún no hay solicitudes finalizadas."}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {shown.map((r) =>
                      tab !== "en_proceso" ? (
                        <CompactRequestCard key={r.id} row={r} me={data.me} onSent={showToast} />
                      ) : r.claimed_by === data.me ? (
                        <DesignerRequestCard key={r.id} row={r} me={data.me} onSent={showToast} />
                      ) : (
                        <PendingCompactCard key={r.id} row={r} me={data.me} />
                      ),
                    )}
                  </div>
                )}
              </>
            );
          })()
        )}
      </main>

      {toast ? (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
          <span className="rounded-full bg-wit-navy px-5 py-2.5 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            ✓ {toast}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function DesignerTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-bold transition-colors ${
        active
          ? "border-wit-blue text-wit-blue"
          : "border-transparent text-wit-gray hover:text-wit-ink"
      }`}
    >
      {label}
      {count > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            active ? "bg-wit-blue/10 text-wit-blue" : "bg-wit-mist/60 text-wit-gray"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

// Small green confirmation that appears right under whichever "Copiar
// prompt" button was clicked, instead of a page-level toast — so the
// designer doesn't have to look away from what they just clicked.
function CopiedNotice() {
  return (
    <span className="absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
      ✓ Prompt copiado
    </span>
  );
}

function FilePreview({ label, fileKey }: { label: string; fileKey: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-wit-ink/10 bg-white p-3">
      <a href={`/api/file?key=${encodeURIComponent(fileKey)}`} target="_blank" rel="noreferrer">
        <img
          src={`/api/file?key=${encodeURIComponent(fileKey)}`}
          alt={label}
          className="h-16 w-16 rounded-lg border border-wit-ink/10 object-cover"
          loading="lazy"
        />
      </a>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-wit-gray">{label}</p>
        <a
          href={`/api/file?key=${encodeURIComponent(fileKey)}&download=1`}
          className="mt-0.5 inline-block text-sm font-semibold text-wit-blue underline-offset-2 hover:underline"
        >
          Descargar
        </a>
      </div>
    </div>
  );
}

// Collapsed row for a pending request not yet claimed by this designer —
// title/format/date only, no client info, no copy-prompt button, to avoid
// showing full detail on work nobody has picked up yet. The glowing ring
// only appears while it's unclaimed (a nudge that it needs someone); once
// claimed the parent swaps this out for the full DesignerRequestCard.
function PendingCompactCard({ row, me }: { row: DesignerRequest; me: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const claimed = Boolean(row.claimed_by);
  const mine = row.claimed_by === me;

  async function claim() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/designer/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) setMsg("Alguien más la acaba de tomar.");
      await qc.invalidateQueries({ queryKey: ["designer-requests"] });
    } catch {
      setMsg("No pudimos tomarla. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const card = (
    <div className="wit-glass flex items-center gap-4 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-wit-ink">{row.title}</p>
        <p className="mt-0.5 text-xs text-wit-gray">
          {row.aspect_ratio}
          {row.style ? ` · ${row.style}` : ""} ·{" "}
          {new Date(row.created_at + "Z").toLocaleString("es-MX")}
        </p>
      </div>
      {!claimed ? (
        <button
          type="button"
          disabled={busy}
          onClick={claim}
          className="shrink-0 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
        >
          {busy ? "Tomando..." : "Tomar solicitud"}
        </button>
      ) : (
        <span className="shrink-0 text-xs font-semibold text-wit-gray">
          {mine ? "Tomada por ti" : `Tomada por ${row.claimed_by_name}`}
        </span>
      )}
    </div>
  );

  return (
    <div>
      {!claimed ? (
        <div className="wit-pending-glow">
          <div className="wit-pending-glow-shield">{card}</div>
        </div>
      ) : (
        card
      )}
      {msg ? <p className="mt-1.5 text-xs text-red-600">{msg}</p> : null}
    </div>
  );
}

// Collapsed row for a request that no longer needs the designer's action —
// delivered (en revisión del cliente), rejected, or closed by the client.
// Title, date, and the delivered thumbnail only — clicking it expands into
// the full DesignerRequestCard for detail instead of always showing every
// field, since none of these ever need action and were just cluttering the
// panel.
function CompactRequestCard({
  row,
  me,
  onSent,
}: {
  row: DesignerRequest;
  me: string;
  onSent: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge =
    row.status === "cerrada"
      ? { label: "✓ Finalizada", cls: "bg-wit-blue/10 text-wit-blue" }
      : row.status === "rechazada"
        ? { label: "✗ Rechazada", cls: "bg-red-50 text-red-600" }
        : { label: "En revisión", cls: "bg-emerald-50 text-emerald-700" };

  const thumb = (() => {
    if (!row.results_json) return null;
    try {
      const arr = (JSON.parse(row.results_json) as ResultItem[]).filter(
        (x) => x && x.kind !== "draft" && (x.image_url || x.r2_key),
      );
      return arr.at(-1) ?? null;
    } catch {
      return null;
    }
  })();
  const thumbHref = thumb
    ? (thumb.image_url ?? `/api/file?key=${encodeURIComponent(thumb.r2_key ?? "")}`)
    : null;

  if (expanded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-2 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          ← Ocultar detalle
        </button>
        <DesignerRequestCard row={row} me={me} onSent={onSent} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="wit-glass flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
    >
      {thumbHref ? (
        <img
          src={thumbHref}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl border border-wit-ink/10 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl bg-wit-mist/40" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-wit-ink">{row.title}</p>
        <p className="mt-0.5 text-xs text-wit-gray">
          {new Date(row.created_at + "Z").toLocaleString("es-MX")}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}>
        {badge.label}
      </span>
    </button>
  );
}

function DesignerRequestCard({
  row,
  me,
  onSent,
}: {
  row: DesignerRequest;
  me: string;
  onSent: (text: string) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState(row.admin_note ?? "");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const allResults = (() => {
    if (!row.results_json) return [] as ResultItem[];
    try {
      return (JSON.parse(row.results_json) as ResultItem[]).filter(
        (x) => x && (x.image_url || x.r2_key),
      );
    } catch {
      return [];
    }
  })();
  const results = allResults.filter((x) => x.kind !== "draft");
  const drafts = allResults.filter((x) => x.kind === "draft");

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

  async function approve() {
    setBusy("approve");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/approve-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      setMsg(
        data.ok ? "Aprobado y entregado al cliente." : "No pudimos aprobarlo. Intenta de nuevo.",
      );
      await refresh();
    } catch {
      setMsg("No pudimos aprobarlo. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function discardDraft(resultId: string) {
    setBusy(`discard-${resultId}`);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/discard-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const data = (await res.json()) as { ok: boolean };
      setMsg(data.ok ? "Borrador descartado." : "No pudimos descartarlo.");
      await refresh();
    } catch {
      setMsg("No pudimos descartarlo.");
    } finally {
      setBusy(null);
    }
  }

  function buildBasePrompt(): string {
    const company = row.company_name
      ? ` La empresa se llama "${row.company_name}"${row.product_name ? ` y el producto "${row.product_name}"` : ""}, ambos deben aparecer en la pieza.`
      : "";
    const pieceBrief = row.piece_brief ? ` Concepto de esta pieza: ${row.piece_brief}.` : "";
    const style = row.style ? ` Estilo: ${row.style}.` : "";
    const audience = row.audience
      ? ` Dirigido a: ${row.audience}${row.age_range ? ` (${row.age_range} años)` : ""}.`
      : row.age_range
        ? ` Dirigido a personas de ${row.age_range} años.`
        : "";
    const promo = row.promo_price ? ` Precio/descuento a destacar: ${row.promo_price}.` : "";
    const requiredText = row.required_text
      ? ` Dato extra del cliente: "${row.required_text}".`
      : "";
    const colors = row.brand_colors ? ` Paleta de colores de marca: ${row.brand_colors}.` : "";
    const ratio = RATIO_PROMPT[row.aspect_ratio] ?? row.aspect_ratio;
    // No reference-download reminder baked in here on purpose — this text
    // gets pasted straight into an image-generating AI, which can't act on
    // a note addressed to the designer. The actual files are already
    // visible with their own download links right below this button.
    return `Creatividad publicitaria profesional de alta calidad. ${row.brief}${company}${pieceBrief}${style}${audience}${promo}${requiredText}${colors} Redacta tú el texto final del anuncio a partir de estos datos (el cliente no escribió el copy). Composición limpia y premium, tipografía legible, colores de marca consistentes, luz de estudio. Usa ${ratio}.`;
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setMsg("No pudimos copiar. Selecciona el texto manualmente.");
    }
  }

  async function copyInfo() {
    // Prefer the ChatGPT-polished version — falls back to the locally-built
    // one only if that background call never finished or failed.
    await copyText(row.ai_prompt ?? buildBasePrompt(), "base");
  }

  async function copyRevisionPrompt(note: string, n: number) {
    const prompt = `Ajusta la creatividad publicitaria anterior aplicando este cambio solicitado por el cliente: ${note}. Mantén todo lo demás igual a la versión anterior. Contexto original de la pieza: ${buildBasePrompt()}`;
    await copyText(prompt, `revision${n}`);
  }

  async function copyChangePrompt(note: string) {
    const prompt = `Corrige un error que el cliente reportó en esta pieza, que ya había sido entregada y marcada como correcta: ${note}. Mantén todo lo demás igual a la versión anterior. Contexto original de la pieza: ${buildBasePrompt()}`;
    await copyText(prompt, "change");
  }

  async function deliver() {
    if (!file) return;
    setBusy("deliver");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", row.id);
      if (note.trim()) fd.append("adminNote", note.trim());
      const res = await fetch("/api/admin/deliver", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setFile(null);
        onSent("Pieza enviada");
      } else {
        setMsg("No pudimos subir el archivo.");
      }
      await refresh();
    } catch {
      setMsg("No pudimos subir el archivo.");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!rejectReason.trim()) return;
    setBusy("reject");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/update-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: row.id,
          status: "rechazada",
          adminNote: rejectReason.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setRejecting(false);
        setRejectReason("");
        onSent("Pieza enviada");
      } else {
        setMsg("No pudimos rechazar la solicitud.");
      }
      await refresh();
    } catch {
      setMsg("No pudimos rechazar la solicitud.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-wit-ink">{row.title}</h3>
          {row.company_name ? (
            <p className="mt-0.5 text-sm font-semibold text-wit-blue">
              {row.company_name}
              {row.product_name ? ` · ${row.product_name}` : ""}
            </p>
          ) : null}
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
          <div className="relative">
            <button
              type="button"
              onClick={copyInfo}
              className="rounded-full border border-wit-ink/15 px-3 py-1.5 text-xs font-semibold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
            >
              Copiar prompt
            </button>
            {copiedKey === "base" ? <CopiedNotice /> : null}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              row.status === "cerrada"
                ? "bg-wit-blue/10 text-wit-blue"
                : row.status === "completada"
                  ? "bg-emerald-50 text-emerald-700"
                  : row.status === "rechazada"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-700"
            }`}
          >
            {row.status === "cerrada" ? "✓ finalizada" : row.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
          A qué se dedica la empresa
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-wit-gray">{row.brief}</p>
      </div>
      {row.piece_brief ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
            Qué quiere el cliente en esta pieza
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-wit-ink">
            {row.piece_brief}
          </p>
        </div>
      ) : null}

      {row.revision_note_1 || row.revision_note_2 ? (
        <div className="mt-3 space-y-2">
          {[
            { n: 1 as const, note: row.revision_note_1 },
            { n: 2 as const, note: row.revision_note_2 },
          ].map(({ n, note }) => {
            if (!note) return null;
            // Only the most recently requested change is still pending — once
            // it's delivered (status back to completada/cerrada) or a newer
            // change has been requested, it's already handled: lock it so the
            // designer doesn't re-copy an old prompt by mistake.
            const isActive = n === row.revisions_used && row.status === "en_proceso";
            return (
              <div
                key={n}
                className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${
                  isActive
                    ? "border-amber-200 bg-amber-50 text-wit-ink"
                    : "border-wit-ink/10 bg-wit-mist/30 text-wit-gray"
                }`}
              >
                <p className="min-w-0 flex-1">
                  <strong className={isActive ? "" : "text-wit-ink"}>
                    Cambio {n} solicitado por el cliente:
                  </strong>{" "}
                  {note}
                </p>
                {isActive ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => copyRevisionPrompt(note, n)}
                      className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
                    >
                      Copiar prompt del cambio
                    </button>
                    {copiedKey === `revision${n}` ? <CopiedNotice /> : null}
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-wit-ink/5 px-3 py-1.5 text-xs font-semibold text-wit-gray">
                    ✓ Ya entregado
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {row.change_request_note && row.status === "en_proceso" ? (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-wit-ink">
          <p className="min-w-0 flex-1">
            <strong>Corrección solicitada por el cliente (pieza ya finalizada):</strong>{" "}
            {row.change_request_note}
          </p>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => copyChangePrompt(row.change_request_note ?? "")}
              className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
            >
              Copiar prompt del cambio
            </button>
            {copiedKey === "change" ? <CopiedNotice /> : null}
          </div>
        </div>
      ) : null}

      {row.audience || row.age_range || row.required_text || row.brand_colors || row.promo_price ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-wit-ice p-4 text-sm sm:grid-cols-4">
          {row.audience ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
                Público
              </dt>
              <dd className="mt-0.5 text-wit-ink">{row.audience}</dd>
            </div>
          ) : null}
          {row.age_range ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
                Edad
              </dt>
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
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
                Colores
              </dt>
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

      {row.logo_key || row.product_photo_key || row.reference_key ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {row.logo_key ? <FilePreview label="Logotipo" fileKey={row.logo_key} /> : null}
          {row.product_photo_key ? (
            <FilePreview label="Foto del producto" fileKey={row.product_photo_key} />
          ) : null}
          {row.reference_key ? (
            <FilePreview label="Referencia (solicitud anterior)" fileKey={row.reference_key} />
          ) : null}
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
            Borrador generado con IA — el cliente todavía no lo ve
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {drafts.map((res) => {
              const href = res.image_url ?? `/api/file?key=${encodeURIComponent(res.r2_key ?? "")}`;
              return (
                <div key={res.id} className="space-y-1.5">
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-amber-300"
                  >
                    <img
                      src={href}
                      alt="Borrador generado con IA"
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  </a>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => discardDraft(res.id)}
                    className="w-full rounded-lg border border-wit-ink/15 py-1 text-[11px] font-semibold text-wit-gray hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  >
                    {busy === `discard-${res.id}` ? "..." : "Descartar"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={approve}
              className="rounded-full bg-wit-blue px-5 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {busy === "approve" ? "Aprobando..." : "Aprobar y enviar al cliente"}
            </button>
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {results.map((res) => {
            const href = res.image_url ?? `/api/file?key=${encodeURIComponent(res.r2_key ?? "")}`;
            return (
              <a
                key={res.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-wit-ink/10"
              >
                <img
                  src={href}
                  alt="Resultado entregado"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
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
      ) : row.status === "cerrada" ? (
        <p className="mt-4 rounded-xl bg-wit-blue/5 px-4 py-3 text-sm font-semibold text-wit-blue">
          ✓ El cliente marcó esta solicitud como correcta y finalizada. Ya no se puede editar.
        </p>
      ) : row.status === "completada" ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          ✓ Ya enviaste esta pieza — está en revisión del cliente.
        </p>
      ) : row.status === "rechazada" ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          ✗ Rechazaste esta solicitud{row.admin_note ? `: "${row.admin_note}"` : "."}
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
            </div>
            {file ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  ✓ Archivo subido
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={deliver}
                  className="rounded-full bg-wit-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue disabled:opacity-50"
                >
                  {busy === "deliver" ? "Enviando..." : "Enviar"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota para el cliente (opcional)"
              className="w-full rounded-lg border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
            />
          </div>

          <div className="mt-4">
            {!rejecting ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setRejecting(true)}
                className="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Rechazar solicitud
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">
                  ¿Por qué se rechaza?
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Explica el motivo — el cliente lo verá."
                  className="mt-1.5 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                    }}
                    className="rounded-full border border-wit-ink/15 px-4 py-2 text-xs font-semibold text-wit-gray hover:border-wit-ink/30"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || !rejectReason.trim()}
                    onClick={reject}
                    className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy === "reject" ? "Enviando..." : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {msg ? (
        <p className="mt-3 rounded-lg bg-wit-mist/40 px-3 py-2 text-sm text-wit-ink">{msg}</p>
      ) : null}
    </article>
  );
}
