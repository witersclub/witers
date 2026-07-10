import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { WitersLogo } from "../components/witers/brand";
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/panel")({
  head: () => ({
    meta: [
      { title: "Mi panel. WITERS" },
      { name: "description", content: "Tu panel de solicitudes de diseño WITERS." },
    ],
  }),
  component: Panel,
});

type RequestRow = {
  id: string;
  title: string;
  company_name: string | null;
  product_name: string | null;
  logo_key: string | null;
  brief: string;
  piece_brief: string | null;
  style: string | null;
  aspect_ratio: string;
  audience: string | null;
  age_range: string | null;
  required_text: string | null;
  brand_colors: string | null;
  promo_price: string | null;
  status: string;
  admin_note: string | null;
  revisions_used: number;
  revision_note_1: string | null;
  revision_note_2: string | null;
  satisfaction_rating: number | null;
  created_at: string;
  results_json: string | null;
};

type ResultItem = { id: string; kind: string; image_url: string | null; r2_key: string | null };

function parseResults(row: RequestRow): ResultItem[] {
  if (!row.results_json) return [];
  try {
    const arr = JSON.parse(row.results_json) as ResultItem[];
    return arr.filter((r) => r && (r.image_url || r.r2_key));
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  en_proceso: { label: "En proceso", cls: "bg-amber-50 text-amber-700" },
  completada: { label: "Completada", cls: "bg-emerald-50 text-emerald-700" },
  cerrada: { label: "✓ Finalizada", cls: "bg-wit-blue/10 text-wit-blue" },
  rechazada: { label: "Rechazada", cls: "bg-red-50 text-red-600" },
};

function Panel() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"solicitudes" | "nueva">("solicitudes");

  const requests = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const res = await fetch("/api/requests", { credentials: "include" });
      if (!res.ok) return { ok: false, requests: [] as RequestRow[] };
      return (await res.json()) as { ok: boolean; requests: RequestRow[] };
    },
    enabled: Boolean(me.data?.ok),
    refetchInterval: 30_000,
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await qc.invalidateQueries();
    navigate({ to: "/" });
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
          Ingresa a tu cuenta para ver tu panel de solicitudes.
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Ingresar
        </Link>
      </div>
    );
  }

  const membership = me.data.membership;
  const active = membership?.status === "active";
  const remaining = membership ? membership.requests_quota - membership.requests_used : 0;
  const rows = requests.data?.requests ?? [];
  // Rows come back newest-first, so the first one with a logo is the most
  // recent request that had one — offered as a shortcut on the new form.
  const previousLogoKey = rows.find((row) => row.logo_key)?.logo_key ?? null;

  return (
    <div className="wit-page min-h-dvh">
      <header className="border-b border-wit-ink/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/">
            <WitersLogo compact />
          </Link>
          <div className="flex items-center gap-5">
            <span className="hidden text-sm text-wit-gray sm:block">{me.data.user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="wit-navlink text-sm font-medium text-wit-ink"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
              Hola, <span className="text-wit-blue">{me.data.user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="mt-2 text-base text-wit-gray">
              Pide creatividades y da seguimiento a cada solicitud desde aquí.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_10px_30px_rgba(5,13,40,0.06)]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-wit-gray">
                Solicitudes disponibles
              </p>
              <p className="font-wit-mono text-3xl font-semibold text-wit-ink">
                {active ? remaining : 0}
                <span className="text-base text-wit-gray">/{membership?.requests_quota ?? 30}</span>
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {active ? "Membresía activa" : "Sin membresía"}
            </span>
          </div>
        </div>

        {!active ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-3xl bg-wit-navy p-8 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-bold">Activa tu membresía para empezar a crear.</p>
              <p className="mt-1 text-sm text-white/70">
                $5,999 MXN. Pago único. 30 solicitudes de diseño con IA incluidas.
              </p>
            </div>
            <Link
              to="/checkout"
              className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:brightness-110"
            >
              Quiero mi membresía
            </Link>
          </div>
        ) : null}

        <div className="mt-10 flex gap-2 border-b border-wit-ink/10">
          <PanelTab
            active={tab === "solicitudes"}
            onClick={() => setTab("solicitudes")}
            label="Mis solicitudes"
            count={rows.length}
          />
          <PanelTab
            active={tab === "nueva"}
            onClick={() => setTab("nueva")}
            label="+ Nueva solicitud"
          />
        </div>

        <div className="mt-8">
          {tab === "nueva" ? (
            <NewRequestForm
              disabled={!active || remaining <= 0}
              previousLogoKey={previousLogoKey}
              onCreated={() => {
                void qc.invalidateQueries({ queryKey: ["requests"] });
                void qc.invalidateQueries({ queryKey: ["me"] });
                setTab("solicitudes");
              }}
            />
          ) : (
            <RequestList
              rows={rows}
              loading={requests.isLoading}
              onNew={() => setTab("nueva")}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function PanelTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
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
      {typeof count === "number" && count > 0 ? (
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

/* ---------- new request form ---------- */

const STYLE_CHIPS = ["Minimalista", "Premium / Elegante", "Colorido", "Corporativo", "Divertido / Bold"];
const AGE_CHIPS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const RATIO_LABEL: Record<string, string> = {
  "1:1": "Cuadrado 1:1 (feed)",
  "4:3": "Horizontal 4:3",
  "16:9": "Horizontal 16:9 (banner)",
  "3:4": "Vertical 3:4",
  "9:16": "Vertical 9:16 (stories)",
};
const RATIO_OPTIONS = [
  { value: "1:1", w: 1, h: 1, label: "Feed" },
  { value: "4:3", w: 4, h: 3, label: "Horizontal" },
  { value: "16:9", w: 16, h: 9, label: "Banner" },
  { value: "3:4", w: 3, h: 4, label: "Vertical" },
  { value: "9:16", w: 9, h: 16, label: "Stories" },
];

function RatioSwatch({ w, h, active }: { w: number; h: number; active: boolean }) {
  const box = 26;
  const scale = box / Math.max(w, h);
  return (
    <span
      className={`block rounded-[3px] border-2 ${active ? "border-wit-blue" : "border-wit-ink/40"}`}
      style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
    />
  );
}

const EMPTY_FORM = {
  title: "",
  companyName: "",
  productName: "",
  brief: "",
  pieceBrief: "",
  style: "",
  aspectRatio: "1:1",
  audience: "",
  promoPrice: "",
  requiredText: "",
};

function NewRequestForm({
  disabled,
  previousLogoKey,
  onCreated,
}: {
  disabled: boolean;
  previousLogoKey: string | null;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [form, setForm] = useState(EMPTY_FORM);
  const [ageRanges, setAgeRanges] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>(["#2563EB"]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [noLogo, setNoLogo] = useState(false);
  const [useSameLogo, setUseSameLogo] = useState(false);
  const [productPhotoFile, setProductPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function selectLogoFile(f: File | null) {
    setLogoFile(f);
    if (f) {
      setNoLogo(false);
      setUseSameLogo(false);
    }
  }

  function selectNoLogo(checked: boolean) {
    setNoLogo(checked);
    if (checked) {
      setLogoFile(null);
      setUseSameLogo(false);
    }
  }

  function selectUseSameLogo(checked: boolean) {
    setUseSameLogo(checked);
    if (checked) {
      setLogoFile(null);
      setNoLogo(false);
    }
  }

  function goToPreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      form.title.trim().length < 3 ||
      form.companyName.trim().length < 2 ||
      form.brief.trim().length < 10 ||
      form.pieceBrief.trim().length < 10
    ) {
      setError("Revisa los campos obligatorios: título, empresa, a qué se dedica y qué quieres en la pieza.");
      return;
    }
    if (!noLogo && !useSameLogo && !logoFile) {
      setError("Sube tu logotipo, marca 'No tengo logotipo' o usa el de tu solicitud anterior.");
      return;
    }
    setStep("preview");
  }

  async function confirmSend() {
    setError(null);
    setOkMsg(null);
    setLoading(true);
    try {
      async function upload(f: File): Promise<string | undefined> {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch("/api/upload-reference", { method: "POST", body: fd });
        const upData = (await up.json()) as { ok: boolean; key?: string };
        return upData.ok ? upData.key : undefined;
      }

      let logoKey: string | undefined;
      if (useSameLogo && previousLogoKey) {
        logoKey = previousLogoKey;
      } else if (logoFile) {
        logoKey = await upload(logoFile);
        if (!logoKey) {
          setError("No pudimos subir tu logotipo (PNG, JPG o WebP, máx. 8 MB).");
          setLoading(false);
          return;
        }
      }

      let productPhotoKey: string | undefined;
      if (productPhotoFile) {
        productPhotoKey = await upload(productPhotoFile);
        if (!productPhotoKey) {
          setError("No pudimos subir la foto del producto (PNG, JPG o WebP, máx. 8 MB).");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          companyName: form.companyName,
          productName: form.productName || undefined,
          brief: form.brief,
          pieceBrief: form.pieceBrief,
          style: form.style || undefined,
          aspectRatio: form.aspectRatio,
          logoKey,
          noLogo,
          productPhotoKey,
          audience: form.audience || undefined,
          ageRange: ageRanges.length ? ageRanges.join(", ") : undefined,
          promoPrice: form.promoPrice || undefined,
          requiredText: form.requiredText || undefined,
          brandColors: colors.length ? colors.join(",") : undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(
          data.error === "sin_saldo"
            ? "Ya usaste todas tus solicitudes disponibles."
            : data.error === "sin_membresia"
              ? "Necesitas una membresía activa para enviar solicitudes."
              : "Revisa los campos obligatorios.",
        );
        setStep("form");
        return;
      }
      setForm(EMPTY_FORM);
      setAgeRanges([]);
      setColors(["#2563EB"]);
      setLogoFile(null);
      setNoLogo(false);
      setUseSameLogo(false);
      setProductPhotoFile(null);
      setStep("form");
      setOkMsg("Solicitud enviada. El equipo WITERS ya está trabajando en ella.");
      onCreated();
    } catch {
      setError("No pudimos enviar tu solicitud. Intenta de nuevo.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  if (step === "preview") {
    return (
      <section className="h-fit rounded-3xl bg-white p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
        <h2 className="text-xl font-bold text-wit-ink">Revisa tu solicitud</h2>
        <p className="mt-1 text-sm text-wit-gray">
          Confirma que todo esté correcto antes de enviarla — usa una de tus solicitudes disponibles.
        </p>

        <dl className="mt-6 space-y-4">
          <PreviewRow label="Título" value={form.title} />
          <PreviewRow label="Nombre comercial / empresa" value={form.companyName} />
          {form.productName ? <PreviewRow label="Nombre del producto" value={form.productName} /> : null}
          <PreviewRow label="A qué se dedica la empresa" value={form.brief} />
          <PreviewRow label="Qué quieres que salga en esta pieza" value={form.pieceBrief} />
          {form.audience ? <PreviewRow label="Público objetivo" value={form.audience} /> : null}
          {ageRanges.length ? <PreviewRow label="Rango de edad" value={ageRanges.join(", ")} /> : null}
          {form.promoPrice ? <PreviewRow label="Precio o descuento" value={form.promoPrice} /> : null}
          {form.requiredText ? <PreviewRow label="Mensaje o dato extra" value={form.requiredText} /> : null}
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
              Colores de marca
            </dt>
            <dd className="mt-1.5 flex gap-2">
              {colors.map((c) => (
                <span
                  key={c}
                  className="h-7 w-7 rounded-full border border-wit-ink/10"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </dd>
          </div>
          {form.style ? <PreviewRow label="Estilo" value={form.style} /> : null}
          <PreviewRow label="Formato" value={RATIO_LABEL[form.aspectRatio] ?? form.aspectRatio} />
          <PreviewRow
            label="Logotipo"
            value={
              noLogo
                ? "No tiene logotipo"
                : useSameLogo
                  ? "Mismo logotipo de tu solicitud anterior"
                  : (logoFile?.name ?? "")
            }
          />
          {productPhotoFile ? <PreviewRow label="Foto del producto" value={productPhotoFile.name} /> : null}
        </dl>

        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={loading}
            className="flex-1 rounded-2xl border border-wit-ink/15 px-6 py-4 text-base font-bold text-wit-ink transition-colors hover:border-wit-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={confirmSend}
            disabled={disabled || loading}
            className="flex-1 rounded-2xl bg-wit-blue px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Confirmar y enviar"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="h-fit rounded-3xl bg-white p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <h2 className="text-xl font-bold text-wit-ink">Nueva solicitud de diseño</h2>
      <p className="mt-1 text-sm text-wit-gray">
        Describe la creatividad publicitaria que necesitas y la generamos con IA. Tu solicitud se
        entrega en un máximo de 3 días hábiles.
      </p>

      <form onSubmit={goToPreview} className="mt-6 space-y-4">
        <div>
          <label htmlFor="rtitle" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Título
          </label>
          <input
            id="rtitle"
            type="text"
            required
            minLength={3}
            maxLength={120}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Anuncio de lanzamiento para Instagram"
          />
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Sobre tu empresa
        </p>
        <div>
          <label htmlFor="rcompany" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Nombre comercial / de la empresa
          </label>
          <input
            id="rcompany"
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="El nombre que va impreso en la pieza"
          />
        </div>
        <div>
          <label htmlFor="rbrief" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            A qué se dedica la empresa
          </label>
          <textarea
            id="rbrief"
            required
            minLength={10}
            maxLength={4000}
            rows={3}
            value={form.brief}
            onChange={(e) => setForm({ ...form, brief: e.target.value })}
            className="w-full resize-y rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Qué vendes y qué te hace diferente..."
          />
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Sobre este pedido
        </p>
        <div>
          <label htmlFor="rproduct" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Nombre del producto <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rproduct"
            type="text"
            maxLength={120}
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Si aplica a un producto en particular"
          />
        </div>
        <div>
          <label htmlFor="rpiecebrief" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Qué quieres que salga en esta pieza
          </label>
          <textarea
            id="rpiecebrief"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={form.pieceBrief}
            onChange={(e) => setForm({ ...form, pieceBrief: e.target.value })}
            className="w-full resize-y rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Describe el concepto de esta pieza: qué debe mostrar, la idea principal..."
          />
        </div>
        <div>
          <label htmlFor="raudience" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Público objetivo <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="raudience"
            type="text"
            maxLength={200}
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Ej. mujeres emprendedoras, dueños de restaurantes..."
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            Rango de edad <span className="font-normal text-wit-gray">(opcional, elige uno o varios)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {AGE_CHIPS.map((a) => (
              <ChipButton
                key={a}
                label={a}
                active={ageRanges.includes(a)}
                onClick={() =>
                  setAgeRanges(
                    ageRanges.includes(a) ? ageRanges.filter((x) => x !== a) : [...ageRanges, a],
                  )
                }
              />
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="rpromo" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Precio o descuento <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rpromo"
            type="text"
            maxLength={80}
            value={form.promoPrice}
            onChange={(e) => setForm({ ...form, promoPrice: e.target.value })}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Ej. $500, 20% de descuento..."
          />
        </div>
        <div>
          <label htmlFor="rreqtext" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Mensaje o dato extra <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rreqtext"
            type="text"
            maxLength={500}
            value={form.requiredText}
            onChange={(e) => setForm({ ...form, requiredText: e.target.value })}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Ej. válido hasta el 31 de julio, nombre de la promoción..."
          />
          <p className="mt-1.5 text-xs text-wit-gray">
            Si lo dejas vacío, nuestro equipo de diseño se encarga de la redacción.
          </p>
        </div>
        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Marca y estilo
        </p>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            Colores de marca <span className="font-normal text-wit-gray">(hasta 3, opcional)</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {colors.map((c, i) => (
              <div key={i} className="relative flex items-center gap-1.5 rounded-xl border border-wit-ink/15 py-1 pl-1 pr-2">
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(c) ? c : "#000000"}
                  onChange={(e) => {
                    const next = [...colors];
                    next[i] = e.target.value;
                    setColors(next);
                  }}
                  className="h-8 w-8 cursor-pointer rounded-full border border-wit-ink/15 p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
                  aria-label={`Color ${i + 1}`}
                />
                <input
                  type="text"
                  value={c}
                  onChange={(e) => {
                    const next = [...colors];
                    next[i] = e.target.value;
                    setColors(next);
                  }}
                  maxLength={7}
                  placeholder="#111827"
                  className="w-20 bg-transparent text-sm font-wit-mono text-wit-ink outline-none"
                  aria-label={`Código hexadecimal del color ${i + 1}`}
                />
                {colors.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setColors(colors.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-wit-ink text-[10px] leading-none text-white"
                    aria-label="Quitar color"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {colors.length < 3 ? (
              <button
                type="button"
                onClick={() => setColors([...colors, "#111827"])}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-wit-ink/25 text-lg text-wit-gray hover:border-wit-blue hover:text-wit-blue"
                aria-label="Agregar color"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            Estilo deseado <span className="font-normal text-wit-gray">(opcional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLE_CHIPS.map((s) => (
              <ChipButton
                key={s}
                label={s}
                active={form.style === s}
                onClick={() => setForm({ ...form, style: form.style === s ? "" : s })}
              />
            ))}
          </div>
          <input
            type="text"
            maxLength={200}
            value={STYLE_CHIPS.includes(form.style) ? "" : form.style}
            onChange={(e) => setForm({ ...form, style: e.target.value })}
            className="mt-2 w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="U otro estilo en tus palabras..."
          />
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">Archivos</p>
        <div>
          <label htmlFor="rlogo" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Logotipo
          </label>
          <input
            id="rlogo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={noLogo || useSameLogo}
            onChange={(e) => selectLogoFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-dashed border-wit-ink/20 px-4 py-3 text-sm text-wit-gray file:mr-3 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-wit-blue disabled:opacity-40"
          />
          {previousLogoKey ? (
            <label className="mt-2 flex items-center gap-2 text-sm text-wit-ink">
              <input
                type="checkbox"
                checked={useSameLogo}
                onChange={(e) => selectUseSameLogo(e.target.checked)}
                className="h-4 w-4 rounded border-wit-ink/30"
              />
              Utilizar el logotipo de la solicitud anterior
              <img
                src={`/api/file?key=${encodeURIComponent(previousLogoKey)}`}
                alt=""
                className="h-6 w-6 rounded border border-wit-ink/10 object-cover"
              />
            </label>
          ) : null}
          <label className="mt-2 flex items-center gap-2 text-sm text-wit-ink">
            <input
              type="checkbox"
              checked={noLogo}
              onChange={(e) => selectNoLogo(e.target.checked)}
              className="h-4 w-4 rounded border-wit-ink/30"
            />
            No tengo logotipo
          </label>
        </div>
        <div>
          <label htmlFor="rproductphoto" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Foto del producto <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rproductphoto"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setProductPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-dashed border-wit-ink/20 px-4 py-3 text-sm text-wit-gray file:mr-3 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-wit-blue"
          />
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">Formato</p>
        <div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {RATIO_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm({ ...form, aspectRatio: r.value })}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
                  form.aspectRatio === r.value
                    ? "border-wit-blue bg-wit-blue/5"
                    : "border-wit-ink/15 hover:border-wit-blue"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center">
                  <RatioSwatch
                    w={r.w}
                    h={r.h}
                    active={form.aspectRatio === r.value}
                  />
                </span>
                <span
                  className={`font-wit-mono text-xs font-bold ${
                    form.aspectRatio === r.value ? "text-wit-blue" : "text-wit-ink"
                  }`}
                >
                  {r.value}
                </span>
                <span className="text-[10px] leading-none text-wit-gray">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
        {okMsg ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{okMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={disabled}
          className="w-full rounded-2xl bg-wit-blue px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
        {disabled ? (
          <p className="text-center text-xs text-wit-gray">
            Necesitas membresía activa y solicitudes disponibles.
          </p>
        ) : null}
      </form>
    </section>
  );
}

function ChipButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-wit-blue bg-wit-blue text-white"
          : "border-wit-ink/15 text-wit-ink hover:border-wit-blue"
      }`}
    >
      {label}
    </button>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-wit-ink">{value}</dd>
    </div>
  );
}

/* ---------- request history ---------- */

function RequestList({
  rows,
  loading,
  onNew,
}: {
  rows: RequestRow[];
  loading: boolean;
  onNew: () => void;
}) {
  return (
    <section>
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-wit-ink/15 bg-white/60 p-10 text-center">
          <p className="text-base font-semibold text-wit-ink">Aún no tienes solicitudes.</p>
          <p className="mt-1 text-sm text-wit-gray">
            Envía tu primera solicitud y aparecerá aquí con su estado.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-5 rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
          >
            Enviar mi primera solicitud
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <HistoryCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function Spinner({ cls = "border-wit-blue" }: { cls?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 ${cls} border-t-transparent`}
      aria-hidden
    />
  );
}

function HistoryCard({ row: r }: { row: RequestRow }) {
  const qc = useQueryClient();
  const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.en_proceso;
  // The API only ever returns the single most recent delivered file, and
  // only while status is "completada" (server-enforced in /api/file too).
  const latestResult = parseResults(r).at(-1) ?? null;
  const [revisionText, setRevisionText] = useState("");
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [closing, setClosing] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; download: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const revisionsLeft = 2 - r.revisions_used;
  const alreadyRated = r.satisfaction_rating !== null;

  // Compact timeline: the original request plus each requested change. Only
  // the last step carries the live status — earlier ones are done by definition.
  const steps: { label: string; detail: string | null }[] = [
    { label: "Solicitud enviada", detail: null },
  ];
  if (r.revision_note_1) steps.push({ label: "Cambio 1", detail: r.revision_note_1 });
  if (r.revision_note_2) steps.push({ label: "Cambio 2", detail: r.revision_note_2 });

  async function finalize() {
    setClosing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/close-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: r.id }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        await qc.invalidateQueries({ queryKey: ["requests"] });
      } else {
        setMsg("No pudimos finalizar la solicitud. Intenta de nuevo.");
      }
    } catch {
      setMsg("No pudimos finalizar la solicitud. Intenta de nuevo.");
    } finally {
      setClosing(false);
    }
  }

  // Downloading the final piece locks the request: with free revisions,
  // clients could otherwise download every version and get 3 designs out
  // of the quota for 1. The first real download finalizes it, same as
  // clicking "finalizar solicitud".
  async function downloadAndFinalize(downloadHref: string) {
    setDownloading(true);
    const wasCompleted = r.status === "completada";
    try {
      if (wasCompleted) {
        await fetch("/api/close-request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: r.id }),
        }).catch(() => null);
        await qc.invalidateQueries({ queryKey: ["requests"] });
      }
      window.location.href = downloadHref;
    } finally {
      setLightbox(null);
      setDownloading(false);
      if (wasCompleted && !alreadyRated) setShowSurvey(true);
    }
  }

  async function sendRevision() {
    if (revisionText.trim().length < 5) {
      setMsg("Cuéntanos con un poco más de detalle qué quieres ajustar.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/request-revision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: r.id, message: revisionText }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setRevisionText("");
        setShowRevisionForm(false);
        setSentMsg("Tu solicitud de cambio ha sido enviada. El equipo ya está trabajando en ella.");
        await qc.invalidateQueries({ queryKey: ["requests"] });
      } else {
        setMsg("No pudimos enviar tu solicitud de cambio. Intenta de nuevo.");
      }
    } catch {
      setMsg("No pudimos enviar tu solicitud de cambio. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-wit-ink">{r.title}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
          {r.status === "en_proceso" ? <Spinner cls="border-amber-600" /> : null}
          {st.label}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-wit-gray">
        Formato {r.aspect_ratio} ·{" "}
        {new Date(r.created_at + "Z").toLocaleDateString("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>

      <div className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-xl bg-wit-ice/60 px-4 py-2.5">
              {isLast && r.status === "en_proceso" ? (
                <Spinner />
              ) : isLast && r.status === "rechazada" ? (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
                  ✕
                </span>
              ) : (
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white ${
                    isLast && r.status === "cerrada" ? "bg-wit-blue" : "bg-emerald-500"
                  }`}
                >
                  ✓
                </span>
              )}
              <span className="flex-1 text-sm font-semibold text-wit-ink">{s.label}</span>
              <span
                className={`text-xs font-bold ${
                  isLast
                    ? r.status === "en_proceso"
                      ? "text-wit-blue"
                      : r.status === "rechazada"
                        ? "text-red-600"
                        : r.status === "cerrada"
                          ? "text-wit-blue"
                          : "text-emerald-600"
                    : "text-emerald-600"
                }`}
              >
                {isLast ? st.label : "Listo"}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowDetail(!showDetail)}
        className="mt-3 text-xs font-semibold text-wit-gray underline-offset-2 hover:text-wit-blue hover:underline"
      >
        {showDetail ? "Ocultar detalle" : "Ver detalle"}
      </button>
      {showDetail ? (
        <div className="mt-2 space-y-2 rounded-xl bg-wit-mist/30 p-4 text-sm text-wit-gray">
          <p>
            <strong className="text-wit-ink">Lo que pediste:</strong> {r.brief}
          </p>
          {r.piece_brief ? (
            <p>
              <strong className="text-wit-ink">Para esta pieza:</strong> {r.piece_brief}
            </p>
          ) : null}
          {steps
            .filter((s) => s.detail)
            .map((s) => (
              <p key={s.label}>
                <strong className="text-wit-ink">{s.label}:</strong> {s.detail}
              </p>
            ))}
        </div>
      ) : null}

      {r.admin_note ? (
        <p className="mt-3 rounded-xl bg-wit-mist/40 px-4 py-2.5 text-sm text-wit-ink">
          <strong>Nota del equipo:</strong> {r.admin_note}
        </p>
      ) : null}
      {latestResult ? (
        <div className="mt-4 w-40 sm:w-48">
          {(() => {
            const res = latestResult;
            const href = res.image_url ?? `/api/file?key=${encodeURIComponent(res.r2_key ?? "")}`;
            const downloadHref = res.image_url
              ? res.image_url
              : `/api/file?key=${encodeURIComponent(res.r2_key ?? "")}&download=1`;
            const img = (
              <img
                src={href}
                alt={`Resultado de ${r.title}`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            );
            // Once cerrada the request already used its one download — the
            // thumbnail stays as a friendly, locked reminder instead of
            // vanishing from the client's history.
            return r.status === "completada" ? (
              <button
                type="button"
                onClick={() => setLightbox({ src: href, download: downloadHref })}
                className="group relative block overflow-hidden rounded-xl border border-wit-ink/10"
              >
                <span className="block transition-transform duration-300 group-hover:scale-105">{img}</span>
                <span className="absolute inset-x-0 bottom-0 bg-wit-navy/80 px-2 py-1.5 text-center text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Ver y descargar
                </span>
              </button>
            ) : (
              <div className="relative block cursor-default overflow-hidden rounded-xl border border-wit-ink/10 opacity-90">
                {img}
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wit-blue text-[10px] font-bold text-white">
                  ✓
                </span>
              </div>
            );
          })()}
        </div>
      ) : null}

      {sentMsg ? (
        <p className="mt-4 rounded-xl bg-wit-blue px-4 py-3 text-sm font-bold text-white">
          ✓ {sentMsg}
        </p>
      ) : null}

      {r.status === "completada" ? (
        showRevisionForm ? (
          <div className="mt-4 rounded-xl bg-wit-ice p-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-wit-gray">
              Qué quieres que ajustemos ({revisionsLeft} {revisionsLeft === 1 ? "cambio disponible" : "cambios disponibles"})
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              className="w-full resize-y rounded-lg border border-wit-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-wit-blue"
              placeholder="Ej. cambiar el color de fondo a azul, agrandar el texto..."
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={sendRevision}
                className="rounded-full bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
              >
                {busy ? "Enviando..." : "Enviar solicitud de cambio"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowRevisionForm(false)}
                className="text-sm font-semibold text-wit-gray hover:text-wit-ink"
              >
                Cancelar
              </button>
            </div>
            {msg ? <p className="mt-2 text-sm text-red-600">{msg}</p> : null}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={closing}
              onClick={finalize}
              className="rounded-full bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {closing ? "Finalizando..." : "✓ Correcto, finalizar solicitud"}
            </button>
            {revisionsLeft > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSentMsg(null);
                  setShowRevisionForm(true);
                }}
                className="rounded-full border border-wit-ink/15 px-4 py-2 text-sm font-semibold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
              >
                Solicitar cambio ({revisionsLeft} {revisionsLeft === 1 ? "disponible" : "disponibles"})
              </button>
            ) : null}
            {msg ? <p className="w-full text-sm text-red-600">{msg}</p> : null}
          </div>
        )
      ) : null}

      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={r.title}
          canDownload={r.status === "completada"}
          downloading={downloading}
          onDownload={() => downloadAndFinalize(lightbox.download)}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      {showSurvey ? (
        <SatisfactionSurvey
          requestId={r.id}
          onDone={async () => {
            setShowSurvey(false);
            await qc.invalidateQueries({ queryKey: ["requests"] });
          }}
        />
      ) : null}
    </article>
  );
}

function ImageLightbox({
  src,
  alt,
  canDownload,
  downloading,
  onDownload,
  onClose,
}: {
  src: string;
  alt: string;
  canDownload: boolean;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/90 p-5"
      onClick={onClose}
    >
      <div className="flex max-h-full max-w-3xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="max-h-[70vh] w-auto rounded-2xl object-contain shadow-2xl"
        />
        {canDownload ? (
          <>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                disabled={downloading}
                onClick={onDownload}
                className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
              >
                {downloading ? "Descargando..." : "Descargar imagen"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
            <p className="mt-3 max-w-xs text-center text-xs text-white/70">
              Si descargas la imagen, tu solicitud se dará por finalizada. Solo puedes descargar una
              versión.
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 max-w-xs text-center text-sm text-white/80">
              Esta solicitud ya fue finalizada — solo se permite descargar una versión por solicitud.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RatingCircle({
  n,
  filled,
  disabled,
  onClick,
  onHover,
}: {
  n: number;
  filled: boolean;
  disabled: boolean;
  onClick: () => void;
  onHover: (n: number | null) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => onHover(n)}
      onMouseLeave={() => onHover(null)}
      className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
    >
      <span className="relative flex h-11 w-11 items-center justify-center active:scale-90">
        <span
          className="absolute inset-0"
          style={{
            clipPath: filled ? CIRCLE_CLIP : STAR_CLIP,
            backgroundColor: filled ? "#0047FF" : "#FACC15",
            transform: filled ? "rotate(0deg)" : "rotate(-14deg)",
            transition:
              "clip-path 550ms cubic-bezier(0.32,1.2,0.5,1), background-color 550ms ease, transform 550ms cubic-bezier(0.32,1.2,0.5,1)",
          }}
        />
        <img
          src="/assets/logo_w_white.png"
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-auto"
          style={{
            opacity: filled ? 1 : 0,
            transform: filled ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.4)",
            transition: "opacity 300ms ease, transform 300ms ease",
            transitionDelay: filled ? "280ms" : "0ms",
          }}
        />
      </span>
      <span
        className="text-xs font-bold"
        style={{ color: filled ? "#0047FF" : "#8a8f98", transition: "color 550ms ease" }}
      >
        {n}
      </span>
    </button>
  );
}

// Both shapes use the same 20 points in the same order (star edges get an
// extra midpoint vertex, which doesn't change the star's silhouette) so the
// browser morphs vertex by vertex into a proper-looking circle, instead of
// stopping at a faceted decagon or just crossfading two unrelated shapes.
const STAR_CLIP =
  "polygon(50% 0%, 55.5% 17.5%, 61% 35%, 79.5% 35%, 98% 35%, 83% 46%, 68% 57%, 73.5% 74%, 79% 91%, 64.5% 80.5%, 50% 70%, 35.5% 80.5%, 21% 91%, 26.5% 74%, 32% 57%, 17% 46%, 2% 35%, 20.5% 35%, 39% 35%, 44.5% 17.5%)";
const CIRCLE_CLIP =
  "polygon(50% 0%, 65.45% 2.45%, 79.39% 9.55%, 90.45% 20.61%, 97.55% 34.55%, 100% 50%, 97.55% 65.45%, 90.45% 79.39%, 79.39% 90.45%, 65.45% 97.55%, 50% 100%, 34.55% 97.55%, 20.61% 90.45%, 9.55% 79.39%, 2.45% 65.45%, 0% 50%, 2.45% 34.55%, 9.55% 20.61%, 20.61% 9.55%, 34.55% 2.45%)";

function SatisfactionSurvey({
  requestId,
  onDone,
}: {
  requestId: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"rate" | "feedback" | "done">("rate");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const shown = hover ?? rating;

  async function submit(n: number, fb?: string) {
    setSubmitting(true);
    try {
      await fetch("/api/submit-satisfaction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, rating: n, feedback: fb }),
      }).catch(() => null);
    } finally {
      setSubmitting(false);
    }
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pick(n: number) {
    setPicking(true);
    setRating(n);
    setHover(null);
    // Brief pause so the star actually shows filled-in-blue-with-logo before
    // the screen moves on — otherwise the transition happens in the same
    // paint and it looks like nothing happened.
    await wait(750);
    if (n === 5) {
      await submit(n);
      setStep("done");
    } else {
      setStep("feedback");
    }
    setPicking(false);
  }

  async function sendFeedback() {
    await submit(rating, feedback.trim() || undefined);
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/70 p-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        {step === "rate" ? (
          <>
            <h3 className="text-lg font-bold text-wit-ink">
              ¿Qué tan satisfecho quedaste con esta pieza?
            </h3>
            <div className="mt-6 flex justify-center gap-2.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <RatingCircle
                  key={n}
                  n={n}
                  filled={n <= shown}
                  disabled={picking}
                  onClick={() => pick(n)}
                  onHover={setHover}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onDone}
              className="mt-7 text-sm font-semibold text-wit-gray hover:text-wit-ink"
            >
              Ahora no
            </button>
          </>
        ) : step === "feedback" ? (
          <>
            <h3 className="text-lg font-bold text-wit-ink">¿Cómo podemos mejorar?</h3>
            <p className="mt-1 text-sm text-wit-gray">Cuéntanos qué fue lo que no te gustó.</p>
            <textarea
              rows={4}
              maxLength={1000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tu comentario nos ayuda a mejorar (opcional)"
              className="mt-4 w-full resize-y rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={sendFeedback}
              className="mt-4 w-full rounded-2xl bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Enviar comentario"}
            </button>
          </>
        ) : (
          <>
            {rating === 5 ? (
              <>
                <p className="text-4xl">🎉</p>
                <h3 className="mt-3 text-lg font-bold text-wit-ink">¡Qué gusto!</h3>
                <p className="mt-2 text-sm text-wit-gray">
                  Nos encanta que tu pieza haya quedado tal como la imaginabas. Gracias por confiar en
                  WITERS.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-wit-ink">Gracias por tu comentario</h3>
                <p className="mt-2 text-sm text-wit-gray">
                  Lo vamos a tomar en cuenta para que tus próximas piezas queden mejor.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={onDone}
              className="mt-6 rounded-full bg-wit-blue px-8 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
            >
              Listo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

