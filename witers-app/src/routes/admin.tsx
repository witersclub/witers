import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administración. WITERS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type AdminUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  membership_status: string | null;
  requests_quota: number | null;
  requests_used: number | null;
  total_paid_mxn: number;
};

type AdminRequest = {
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
  created_at: string;
  user_email: string;
  user_name: string;
  claimed_by_name: string | null;
  results_json: string | null;
};

type ResultItem = { id: string; kind: string; image_url: string | null; r2_key: string | null };

type AdminPayment = {
  id: string;
  user_email: string;
  amount_mxn: number;
  provider: string;
  status: string;
  created_at: string;
};

type AdminDesigner = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  claimed_count: number;
  completed_count: number;
};

type Overview = {
  ok: boolean;
  users: AdminUser[];
  requests: AdminRequest[];
  payments: AdminPayment[];
  designers: AdminDesigner[];
};

function usePlatformUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      // Only an account with role 'admin' may see the console.
      if (!body.ok || body.user?.role !== "admin") return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

function Admin() {
  const platform = usePlatformUser();
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as Overview;
    },
    enabled: Boolean(platform.data),
    refetchInterval: 30_000,
  });
  const [tab, setTab] = useState<"solicitudes" | "usuarios" | "pagos" | "diseñadores">("solicitudes");

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
          El panel de administración requiere una cuenta con rol de administrador. Inicia sesión y
          vuelve a esta página.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/ingresar";
          }}
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión de administrador
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
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-5">
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink">
          Panel de <span className="text-wit-blue">administración</span>
        </h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Usuarios" value={data?.users.length ?? 0} />
          <StatCard
            label="Solicitudes en proceso"
            value={data?.requests.filter((r) => r.status === "en_proceso").length ?? 0}
          />
          <StatCard
            label="Ingresos (MXN)"
            value={`$${(
              (data?.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_mxn, 0) ?? 0)
            ).toLocaleString("es-MX")}`}
          />
        </div>

        <div className="mt-8 flex gap-2 border-b border-wit-ink/10">
          {(["solicitudes", "diseñadores", "usuarios", "pagos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "border-wit-blue text-wit-blue" : "border-transparent text-wit-gray hover:text-wit-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {overview.isLoading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : !data?.ok ? (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            No pudimos cargar los datos de administración.
          </p>
        ) : tab === "solicitudes" ? (
          <RequestsAdmin rows={data.requests} />
        ) : tab === "diseñadores" ? (
          <DesignersPanel rows={data.designers} />
        ) : tab === "usuarios" ? (
          <UsersTable rows={data.users} />
        ) : (
          <PaymentsTable rows={data.payments} />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="wit-glass rounded-2xl px-6 py-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-wit-gray">{label}</p>
      <p className="mt-1 font-wit-mono text-3xl font-semibold text-wit-ink">{value}</p>
    </div>
  );
}

/* ---------- requests management ---------- */

function RequestsAdmin({ rows }: { rows: AdminRequest[] }) {
  const [tab, setTab] = useState<"pendientes" | "finalizadas">("pendientes");

  if (rows.length === 0) {
    return (
      <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
        <p className="text-base font-semibold text-wit-ink">No hay solicitudes todavía.</p>
      </div>
    );
  }

  const pending = rows.filter((r) => r.status !== "cerrada");
  const finished = rows.filter((r) => r.status === "cerrada");
  const shown = tab === "pendientes" ? pending : finished;

  return (
    <div>
      <div className="mt-6 flex gap-2 border-b border-wit-ink/10">
        <AdminSubTab
          active={tab === "pendientes"}
          onClick={() => setTab("pendientes")}
          label="Pendientes"
          count={pending.length}
        />
        <AdminSubTab
          active={tab === "finalizadas"}
          onClick={() => setTab("finalizadas")}
          label="Finalizadas"
          count={finished.length}
        />
      </div>

      {shown.length === 0 ? (
        <div className="wit-glass mt-6 rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
          <p className="text-base font-semibold text-wit-ink">
            {tab === "pendientes" ? "No hay solicitudes pendientes." : "Aún no hay solicitudes finalizadas."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {shown.map((r) =>
            tab === "finalizadas" ? (
              <FinishedRequestCard key={r.id} row={r} />
            ) : (
              <RequestCard key={r.id} row={r} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function AdminSubTab({
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
        active ? "border-wit-blue text-wit-blue" : "border-transparent text-wit-gray hover:text-wit-ink"
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

// Collapsed row for an already-finalized request: title, date, and the
// delivered thumbnail only — clicking it expands into the full RequestCard
// instead of always showing every field.
function FinishedRequestCard({ row }: { row: AdminRequest }) {
  const [expanded, setExpanded] = useState(false);

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
  const thumbHref = thumb ? (thumb.image_url ?? `/api/file?key=${encodeURIComponent(thumb.r2_key ?? "")}`) : null;

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
        <RequestCard row={row} />
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
      <span className="shrink-0 rounded-full bg-wit-blue/10 px-3 py-1 text-xs font-bold text-wit-blue">
        ✓ Finalizada
      </span>
    </button>
  );
}

const RATIO_PROMPT: Record<string, string> = {
  "1:1": "formato cuadrado 1:1 (feed)",
  "4:3": "formato horizontal 4:3",
  "16:9": "formato horizontal 16:9 (banner)",
  "3:4": "formato vertical 3:4",
  "9:16": "formato vertical 9:16 (stories)",
};

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

function RequestCard({ row }: { row: AdminRequest }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState(row.admin_note ?? "");
  const [approveCode, setApproveCode] = useState("");

  const { drafts, results } = (() => {
    if (!row.results_json) return { drafts: [] as ResultItem[], results: [] as ResultItem[] };
    try {
      const all = (JSON.parse(row.results_json) as ResultItem[]).filter(
        (x) => x && (x.image_url || x.r2_key),
      );
      return { drafts: all.filter((x) => x.kind === "draft"), results: all.filter((x) => x.kind !== "draft") };
    } catch {
      return { drafts: [] as ResultItem[], results: [] as ResultItem[] };
    }
  })();

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  async function copyInfo() {
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
    const requiredText = row.required_text ? ` Dato extra del cliente: "${row.required_text}".` : "";
    const colors = row.brand_colors ? ` Paleta de colores de marca: ${row.brand_colors}.` : "";
    const ratio = RATIO_PROMPT[row.aspect_ratio] ?? row.aspect_ratio;
    const hasFiles = row.logo_key || row.product_photo_key || row.reference_key;
    const reference = hasFiles
      ? " El cliente adjuntó logo y/o foto de producto — descárgalos desde el panel y súbelos junto con este prompt si tu herramienta de IA lo permite."
      : "";

    const prompt = `Creatividad publicitaria profesional de alta calidad. ${row.brief}${company}${pieceBrief}${style}${audience}${promo}${requiredText}${colors} Redacta tú el texto final del anuncio a partir de estos datos (el cliente no escribió el copy). Composición limpia y premium, tipografía legible, colores de marca consistentes, luz de estudio. Usa ${ratio}.${reference}`;

    try {
      await navigator.clipboard.writeText(prompt);
      setMsg("Prompt copiado al portapapeles.");
    } catch {
      setMsg("No pudimos copiar. Selecciona el texto manualmente.");
    }
  }

  async function approve() {
    if (!approveCode.trim()) {
      setMsg("Escribe tu código de aprobación.");
      return;
    }
    setBusy("approve");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/approve-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id, code: approveCode }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setMsg(
        data.ok
          ? "Aprobado y entregado al cliente."
          : data.error === "codigo_incorrecto"
            ? "Código incorrecto."
            : "No pudimos aprobarlo. Intenta de nuevo.",
      );
      if (data.ok) setApproveCode("");
      await refresh();
    } catch {
      setMsg("No pudimos aprobarlo. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function discard(resultId: string) {
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
            {row.user_name} ({row.user_email}) · {row.aspect_ratio}
            {row.style ? ` · ${row.style}` : ""} ·{" "}
            {new Date(row.created_at + "Z").toLocaleString("es-MX")}
          </p>
          <p className="mt-1 text-xs font-semibold">
            {row.claimed_by_name ? (
              <span className="text-wit-blue">Atendido por {row.claimed_by_name}</span>
            ) : (
              <span className="text-wit-gray">Sin tomar por ningún diseñador</span>
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
          <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-wit-ink">{row.piece_brief}</p>
        </div>
      ) : null}

      {row.revision_note_1 || row.revision_note_2 ? (
        <div className="mt-3 space-y-2">
          {row.revision_note_1 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-wit-ink">
              <strong>Cambio 1 solicitado por el cliente:</strong> {row.revision_note_1}
            </div>
          ) : null}
          {row.revision_note_2 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-wit-ink">
              <strong>Cambio 2 solicitado por el cliente:</strong> {row.revision_note_2}
            </div>
          ) : null}
        </div>
      ) : null}

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

      {drafts.length > 0 && row.status !== "cerrada" ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
            Pendiente de tu aprobación — el cliente todavía no la ve
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {drafts.map((res) => {
              const href = res.image_url ?? `/api/file?key=${encodeURIComponent(res.r2_key ?? "")}`;
              return (
                <div key={res.id} className="space-y-1.5">
                  <a href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-amber-300">
                    <img src={href} alt="Borrador generado" className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => discard(res.id)}
                    className="w-full rounded-lg border border-wit-ink/15 py-1 text-[11px] font-semibold text-wit-gray hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  >
                    {busy === `discard-${res.id}` ? "..." : "Descartar"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={approveCode}
              onChange={(e) => setApproveCode(e.target.value)}
              placeholder="Tu código de aprobación"
              className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-wit-blue"
            />
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
              <a key={res.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-wit-ink/10">
                <img src={href} alt="Resultado entregado" className="aspect-square w-full object-cover" loading="lazy" />
              </a>
            );
          })}
        </div>
      ) : null}

      {row.status === "cerrada" ? (
        <p className="mt-4 rounded-xl bg-wit-blue/5 px-4 py-3 text-sm font-semibold text-wit-blue">
          ✓ El cliente marcó esta solicitud como correcta y finalizada. Ya no se puede editar.
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
                  {file ? file.name.slice(0, 24) : "Elegir archivo manual"}
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

/* ---------- designers ---------- */

function DesignersPanel({ rows }: { rows: AdminDesigner[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function deactivate(d: AdminDesigner) {
    if (!window.confirm(`¿Dar de baja a ${d.name}? Ya no podrá iniciar sesión como diseñador.`)) {
      return;
    }
    setRemovingId(d.id);
    try {
      await fetch("/api/admin/deactivate-designer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: d.id }),
      });
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } finally {
      setRemovingId(null);
    }
  }

  async function createDesigner(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/create-designer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setMsg(
          data.error === "correo_registrado"
            ? "Ese correo ya está registrado."
            : "Revisa los campos (nombre, correo válido, contraseña de al menos 8 caracteres).",
        );
        return;
      }
      setMsg(`Cuenta creada. Comparte estas credenciales con ${name}: ${email} / ${password}`);
      setName("");
      setEmail("");
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      setMsg("No pudimos crear la cuenta. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <section className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <h2 className="text-base font-bold text-wit-ink">Crear cuenta de diseñador</h2>
        <p className="mt-1 text-sm text-wit-gray">
          Tú eliges la contraseña y se la compartes directamente — el diseñador no se registra
          solo.
        </p>
        <form onSubmit={createDesigner} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            className="rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña temporal"
            className="rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50 sm:col-span-3 sm:w-fit"
          >
            {busy ? "Creando..." : "Crear diseñador"}
          </button>
        </form>
        {msg ? <p className="mt-3 rounded-lg bg-wit-mist/40 px-3 py-2 text-sm text-wit-ink">{msg}</p> : null}
      </section>

      <div className="wit-glass overflow-x-auto rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
              <th className="px-5 py-3.5">Diseñador</th>
              <th className="px-5 py-3.5">Tomadas</th>
              <th className="px-5 py-3.5">Entregadas</th>
              <th className="px-5 py-3.5">Alta</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-wit-ink/5 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-wit-ink">{d.name}</p>
                  <p className="text-xs text-wit-gray">{d.email}</p>
                </td>
                <td className="px-5 py-3.5 font-wit-mono">{d.claimed_count}</td>
                <td className="px-5 py-3.5 font-wit-mono">{d.completed_count}</td>
                <td className="px-5 py-3.5 text-xs text-wit-gray">
                  {new Date(d.created_at + "Z").toLocaleDateString("es-MX")}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    disabled={removingId === d.id}
                    onClick={() => deactivate(d)}
                    aria-label={`Dar de baja a ${d.name}`}
                    title="Dar de baja"
                    className="rounded-lg p-2 text-wit-gray transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-wit-gray">Aún no tienes diseñadores.</p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- users & payments ---------- */

function UsersTable({ rows }: { rows: AdminUser[] }) {
  return (
    <div className="wit-glass mt-6 overflow-x-auto rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
            <th className="px-5 py-3.5">Usuario</th>
            <th className="px-5 py-3.5">Membresía</th>
            <th className="px-5 py-3.5">Solicitudes</th>
            <th className="px-5 py-3.5">Pagado</th>
            <th className="px-5 py-3.5">Alta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-wit-ink/5 last:border-0">
              <td className="px-5 py-3.5">
                <p className="font-semibold text-wit-ink">{u.name}</p>
                <p className="text-xs text-wit-gray">{u.email}</p>
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    u.membership_status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {u.membership_status === "active" ? "Activa" : "Sin activar"}
                </span>
              </td>
              <td className="px-5 py-3.5 font-wit-mono">
                {u.requests_used ?? 0}/{u.requests_quota ?? 0}
              </td>
              <td className="px-5 py-3.5 font-wit-mono">${u.total_paid_mxn.toLocaleString("es-MX")}</td>
              <td className="px-5 py-3.5 text-xs text-wit-gray">
                {new Date(u.created_at + "Z").toLocaleDateString("es-MX")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-wit-gray">Sin usuarios registrados aún.</p>
      ) : null}
    </div>
  );
}

function PaymentsTable({ rows }: { rows: AdminPayment[] }) {
  return (
    <div className="wit-glass mt-6 overflow-x-auto rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-wit-ink/10 text-xs uppercase tracking-wider text-wit-gray">
            <th className="px-5 py-3.5">Fecha</th>
            <th className="px-5 py-3.5">Usuario</th>
            <th className="px-5 py-3.5">Monto</th>
            <th className="px-5 py-3.5">Proveedor</th>
            <th className="px-5 py-3.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-wit-ink/5 last:border-0">
              <td className="px-5 py-3.5 text-xs text-wit-gray">
                {new Date(p.created_at + "Z").toLocaleString("es-MX")}
              </td>
              <td className="px-5 py-3.5">{p.user_email}</td>
              <td className="px-5 py-3.5 font-wit-mono">${p.amount_mxn.toLocaleString("es-MX")}</td>
              <td className="px-5 py-3.5">{p.provider}</td>
              <td className="px-5 py-3.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-wit-gray">Sin pagos registrados aún.</p>
      ) : null}
    </div>
  );
}

