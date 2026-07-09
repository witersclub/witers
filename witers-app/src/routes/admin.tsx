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
  brief: string;
  style: string | null;
  aspect_ratio: string;
  audience: string | null;
  age_range: string | null;
  required_text: string | null;
  brand_colors: string | null;
  reference_key: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  user_email: string;
  user_name: string;
  results_json: string | null;
};

type AdminPayment = {
  id: string;
  user_email: string;
  amount_mxn: number;
  provider: string;
  status: string;
  created_at: string;
};

type Overview = {
  ok: boolean;
  users: AdminUser[];
  requests: AdminRequest[];
  payments: AdminPayment[];
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
  const [tab, setTab] = useState<"solicitudes" | "usuarios" | "pagos">("solicitudes");

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
      <header className="border-b border-wit-ink/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/">
              <WitersLogo compact />
            </Link>
            <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
              ADMIN
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
          {(["solicitudes", "usuarios", "pagos"] as const).map((t) => (
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
    <div className="rounded-2xl bg-white px-6 py-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-wit-gray">{label}</p>
      <p className="mt-1 font-wit-mono text-3xl font-semibold text-wit-ink">{value}</p>
    </div>
  );
}

/* ---------- requests management ---------- */

function RequestsAdmin({ rows }: { rows: AdminRequest[] }) {
  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-wit-ink/15 bg-white/60 p-10 text-center">
        <p className="text-base font-semibold text-wit-ink">No hay solicitudes todavía.</p>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-5">
      {rows.map((r) => (
        <RequestCard key={r.id} row={r} />
      ))}
    </div>
  );
}

function RequestCard({ row }: { row: AdminRequest }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState(() => buildPrompt(row));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState(row.admin_note ?? "");
  const [approveCode, setApproveCode] = useState("");

  type ResultItem = { id: string; kind: string; image_url: string | null; r2_key: string | null };

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

  async function generate() {
    setBusy("generate");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: row.id, prompt, aspectRatio: row.aspect_ratio }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setMsg(
        data.ok
          ? "Imagen generada. Revísala abajo y apruébala con tu código para entregarla al cliente."
          : `La generación falló (${data.error ?? "error"}). Intenta de nuevo o entrega manualmente.`,
      );
      await refresh();
    } catch {
      setMsg("La generación falló. Intenta de nuevo.");
    } finally {
      setBusy(null);
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
    <article className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-wit-ink">{row.title}</h3>
          <p className="mt-0.5 text-xs text-wit-gray">
            {row.user_name} ({row.user_email}) · {row.aspect_ratio}
            {row.style ? ` · ${row.style}` : ""} ·{" "}
            {new Date(row.created_at + "Z").toLocaleString("es-MX")}
          </p>
        </div>
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

      <p className="mt-3 whitespace-pre-wrap text-sm text-wit-gray">{row.brief}</p>

      {row.audience || row.age_range || row.required_text || row.brand_colors ? (
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
          {row.required_text ? (
            <div className="col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-wit-gray">
                Texto requerido
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
        <a
          href={`/api/file?key=${encodeURIComponent(row.reference_key)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-wit-blue underline-offset-2 hover:underline"
        >
          Ver referencia del cliente
        </a>
      ) : null}

      {drafts.length > 0 ? (
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

      <div className="mt-5 rounded-xl bg-wit-ice p-4">
        <label htmlFor={`p-${row.id}`} className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-wit-gray">
          Prompt para generar con IA
        </label>
        <textarea
          id={`p-${row.id}`}
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full resize-y rounded-lg border border-wit-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-wit-blue"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={generate}
            className="rounded-full bg-wit-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-wit-blue-deep disabled:opacity-50"
          >
            {busy === "generate" ? "Generando (1-2 min)..." : "Generar con IA y entregar"}
          </button>

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

      {msg ? <p className="mt-3 rounded-lg bg-wit-mist/40 px-3 py-2 text-sm text-wit-ink">{msg}</p> : null}
    </article>
  );
}

function buildPrompt(row: AdminRequest): string {
  const style = row.style ? ` Estilo: ${row.style}.` : "";
  const audience = row.audience
    ? ` Dirigido a: ${row.audience}${row.age_range ? ` (${row.age_range} años)` : ""}.`
    : row.age_range
      ? ` Dirigido a personas de ${row.age_range} años.`
      : "";
  const requiredText = row.required_text ? ` El texto debe incluir: "${row.required_text}".` : "";
  const colors = row.brand_colors ? ` Paleta de colores de marca: ${row.brand_colors}.` : "";
  return `Creatividad publicitaria profesional de alta calidad. ${row.brief}${style}${audience}${requiredText}${colors} Composición limpia y premium, tipografía legible si lleva texto, colores de marca consistentes, luz de estudio.`;
}

/* ---------- users & payments ---------- */

function UsersTable({ rows }: { rows: AdminUser[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
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
    <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
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

