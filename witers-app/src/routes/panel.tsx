import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { WitersLogo, WMark } from "../components/witers/brand";
import { ChatBubble, ChatIntakeFlow } from "../components/witers/chat-intake";
import { MicButton } from "../components/witers/mic-button";
import {
  AspectRatioPicker,
  BusinessTypeWheel,
  ColorsPicker,
  LogoUploadPicker,
  ProductPhotoUploadPicker,
  uploadReferenceFile,
} from "../components/witers/lab-pickers";
import { consumeTeaserAnswers } from "../lib/teaser-handoff";
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

type PreviousAnswers = {
  title: string | null;
  companyName: string | null;
  productName: string | null;
  pieceBrief: string | null;
  audience: string | null;
  promoPrice: string | null;
  requiredText: string | null;
  style: string | null;
};

// One membership, one business: once this exists, company_name/brand_colors
// (and logo_key once given) are locked and reused on every request from
// here on, in both the chat and the classic form — see /api/requests.
type BrandProfile = {
  user_id: string;
  company_name: string;
  brand_colors: string | null;
  business_type: string | null;
  logo_key: string | null;
  brand_manual_key: string | null;
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
  // Top-level areas of the panel — Creatividad wraps everything that
  // existed before this section was introduced (solicitudes + hacer
  // solicitud); Activos de marca and Campañas are new.
  const [section, setSection] = useState<"creatividad" | "activos" | "campanas">("creatividad");
  // "Hacer solicitud" is the default landing tab for every visit, not just
  // a brand-new client's — creating a piece is the panel's main job, so it
  // should be the first thing anyone sees, not something they have to
  // switch to.
  const [tab, setTab] = useState<"solicitudes" | "nueva">("nueva");
  // The chat is a takeover of the content area, not a third tab — a totally
  // new client (no requests yet) lands straight on it; a returning one opens
  // it with the glowing "Chat IA" button and closes it (or taps a tab) to
  // get back to their solicitudes.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [justSent, setJustSent] = useState(false);
  // Read (and clear) once per mount — only the very first chat (chatKey
  // still at its initial value) should inherit these, not a later
  // conversation opened via the button.
  const [teaserAnswers] = useState(() => consumeTeaserAnswers());

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

  // One membership, one business — once set (see /api/requests), company
  // name/colors/logo are locked here too, not just suggested.
  const brandProfileQuery = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand-profile", { credentials: "include" });
      if (!res.ok) return { ok: false, profile: null as BrandProfile | null };
      return (await res.json()) as { ok: boolean; profile: BrandProfile | null };
    },
    enabled: Boolean(me.data?.ok),
  });

  function openChat() {
    setChatKey((k) => k + 1);
    setChatOpen(true);
  }

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

  // A designer account has no business in the client panel (membership,
  // checkout, request forms) — send them to their own work panel instead.
  if (me.data.user?.role === "designer") {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          Esta cuenta es de diseñador. Ve a tu panel de trabajo.
        </p>
        <Link
          to="/witer"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Ir a mi panel
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
  // Offer every text field as an autocomplete-style suggestion from the
  // client's most recent request, so returning clients don't retype the
  // same answers every time.
  const lastRow = rows[0];
  const previousAnswers: PreviousAnswers | null = lastRow
    ? {
        title: lastRow.title || null,
        companyName: lastRow.company_name,
        productName: lastRow.product_name,
        pieceBrief: lastRow.piece_brief,
        audience: lastRow.audience,
        promoPrice: lastRow.promo_price,
        requiredText: lastRow.required_text,
        style: lastRow.style,
      }
    : null;
  const brandProfile = brandProfileQuery.data?.profile ?? null;
  // Every member goes through the mandatory brand-onboarding chat exactly
  // once, before anything else in the panel — company name/colors/
  // category/logo get locked in right here instead of trickling in from
  // whatever a client happens to type on their first design request.
  // Gated on brandProfileQuery having actually resolved (not just
  // !brandProfile) so a still-loading query never flashes the gate for a
  // returning member who already has one.
  const needsOnboarding = brandProfileQuery.isFetched && !brandProfile;

  if (brandProfileQuery.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  return (
    // min-h-svh (stable "small viewport height"), not min-h-dvh — dvh
    // recalculates continuously as the on-screen keyboard's height shifts
    // (e.g. the predictive-text bar changing as you type), which was
    // forcing a layout reflow on close to every keystroke while answering
    // the AI chat and reading as the whole page "jumping."
    <div className="wit-page min-h-svh">
      {justSent ? (
        <div className="wit-rise fixed inset-x-0 top-5 z-50 flex justify-center px-5">
          <div className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(5,13,40,0.25)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            Enviado
          </div>
        </div>
      ) : null}
      <header className="wit-glass border-b border-wit-ink/10">
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
        {needsOnboarding ? (
          <OnboardingGate
            onDone={() => void qc.invalidateQueries({ queryKey: ["brand-profile"] })}
          />
        ) : (
          <>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
                  Hola, <span className="text-wit-blue">{me.data.user?.name?.split(" ")[0]}</span>
                </h1>
                <p className="mt-2 text-base text-wit-gray">
                  Pide creatividades y da seguimiento a cada solicitud desde aquí.
                </p>
              </div>

              <div className="wit-glass flex items-center gap-4 rounded-2xl px-5 py-4 shadow-[0_10px_30px_rgba(5,13,40,0.06)]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-wit-gray">
                    Solicitudes disponibles
                  </p>
                  <p className="font-wit-mono text-3xl font-semibold text-wit-ink">
                    {active ? remaining : 0}
                    <span className="text-base text-wit-gray">
                      /{membership?.requests_quota ?? 20}
                    </span>
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
                    $5,999 MXN al mes. 20 solicitudes de diseño con IA incluidas.
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

            <SectionNav section={section} onChange={setSection} />

            {section === "creatividad" ? (
              <>
                <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-wit-ink/10 pb-0">
                  <button
                    type="button"
                    onClick={() => setTab("nueva")}
                    className="-mb-px flex shrink-0 items-center gap-1.5 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
                  >
                    ✨ Hacer solicitud
                  </button>
                  <PanelTab
                    active={tab === "solicitudes"}
                    onClick={() => setTab("solicitudes")}
                    label="Mis solicitudes"
                    count={rows.length}
                  />
                </div>

                <div className="mt-8">
                  {tab === "nueva" ? (
                    <HablaConWitScreen onStart={openChat} />
                  ) : (
                    <RequestList
                      rows={rows}
                      loading={requests.isLoading}
                      onNew={() => setTab("nueva")}
                    />
                  )}
                </div>
              </>
            ) : section === "activos" ? (
              <div className="mt-8">
                <ActivosDeMarca brandProfile={brandProfile} />
              </div>
            ) : (
              <div className="mt-8">
                <CampanasComingSoon />
              </div>
            )}
          </>
        )}
      </main>

      {chatOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-white">
              <WitConversation
                key={chatKey}
                disabled={!active || remaining <= 0}
                brandProfile={brandProfile}
                initialAnswers={chatKey === 0 ? (teaserAnswers ?? undefined) : undefined}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["requests"] });
                  void qc.invalidateQueries({ queryKey: ["me"] });
                  void qc.invalidateQueries({ queryKey: ["brand-profile"] });
                  setChatOpen(false);
                  setChatKey((k) => k + 1);
                  setTab("solicitudes");
                  setJustSent(true);
                  window.setTimeout(() => setJustSent(false), 3000);
                }}
                onClose={() => setChatOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// Every field here maps straight onto a brand_profiles column. logoKey
// stays required:true — same as the rest of this file's chat questions —
// because LogoUploadPicker already has its own "No tengo logotipo"
// checkbox as the one non-blocking escape valve; the required flag only
// gates the generic type-or-speak composer, never a dedicated picker.
const ONBOARDING_QUESTIONS: { field: string; text: string; required: boolean }[] = [
  { field: "companyName", text: "¿Cuál es el nombre de tu empresa o marca?", required: true },
  {
    field: "colors",
    text: "¿Tienes colores de marca que debamos usar? Si no tienes, elige los que más te gusten.",
    required: true,
  },
  { field: "businessType", text: "¿En qué categoría cae tu negocio?", required: true },
  { field: "logoKey", text: "Sube tu logotipo.", required: true },
];

// Mandatory, one-time chat that runs before anything else in the panel —
// collects the brand identity that /api/requests used to only infer from
// a client's very first design request. Resumable: every answer autosaves
// to brand_onboarding_drafts (see /api/onboarding/draft), so a client who
// closes the tab partway through picks up exactly where they left off.
function OnboardingGate({ onDone }: { onDone: () => void }) {
  const draftQuery = useQuery({
    queryKey: ["onboarding-draft"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/draft", { credentials: "include" });
      if (!res.ok) return { ok: false, answers: {} as Record<string, string> };
      return (await res.json()) as { ok: boolean; answers: Record<string, string> };
    },
  });
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function pickerFor(field: string, onPick: (value: string) => void) {
    switch (field) {
      case "colors":
        return <ColorsPicker onPick={onPick} />;
      case "businessType":
        return <BusinessTypeWheel onPick={onPick} />;
      case "logoKey":
        return <LogoUploadPicker onPick={onPick} />;
      default:
        return null;
    }
  }

  async function finish(answers: Record<string, string>) {
    setSendError(null);
    setSending(true);
    try {
      const noLogo = answers.logoKey === "Sin logotipo";
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: answers.companyName,
          brandColors: answers.colors || undefined,
          businessType: answers.businessType || undefined,
          logoKey: noLogo ? undefined : answers.logoKey || undefined,
          noLogo,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setSendError(data.message ?? "Revisa tus respuestas e intenta de nuevo.");
        setSending(false);
        return;
      }
      onDone();
    } catch {
      setSendError("No pudimos guardar los datos de tu marca. Intenta de nuevo.");
      setSending(false);
    }
  }

  if (draftQuery.isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-wit-blue/20 border-t-wit-blue" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-260px)] min-h-[420px] w-full max-w-2xl flex-col">
      <p className="mb-2 shrink-0 rounded-xl bg-wit-blue/5 px-3 py-2 text-center text-xs font-medium text-wit-blue">
        Antes de tu primera solicitud, cuéntanos de tu marca — solo te lo preguntamos una vez.
      </p>
      <ChatIntakeFlow
        questions={ONBOARDING_QUESTIONS}
        pickerFor={pickerFor}
        initialAnswers={draftQuery.data?.answers}
        eyebrow="Conozcamos tu marca"
        onAnswer={(answers) => {
          void fetch("/api/onboarding/draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answers }),
          });
        }}
        onComplete={(answers) => void finish(answers)}
        pending={sending}
        pendingLabel="Guardando los datos de tu marca..."
        doneLabel={
          sendError
            ? "No pudimos guardar los datos — mantén presionada cualquier respuesta para reintentar."
            : "Los datos de tu marca han sido creados."
        }
        externalError={sendError}
      />
    </div>
  );
}

// The interstitial that opens when the "✨ Hacer solicitud" tab is
// selected — a deliberate extra tap before the chat itself, so every
// client (not just brand-new ones) sees this moment instead of only
// stumbling into it once.
function HablaConWitScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-3xl bg-wit-ice py-20 text-center">
      <div className="wit-float">
        <WMark size={44} />
      </div>
      <p className="max-w-xs text-base text-wit-gray">
        Cuéntanos qué quieres crear hoy y armamos tu pieza juntos.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
      >
        ✨ Habla con Wit ✨
      </button>
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
        active
          ? "border-wit-blue text-wit-blue"
          : "border-transparent text-wit-gray hover:text-wit-ink"
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

/* ---------- top-level panel sections ---------- */

const SECTIONS: { id: "creatividad" | "activos" | "campanas"; label: string }[] = [
  { id: "creatividad", label: "Creatividad" },
  { id: "activos", label: "Activos de marca" },
  { id: "campanas", label: "Campañas" },
];

// The panel's primary navigation — one level above "Mis solicitudes / Hacer
// solicitud", which now only lives inside "Creatividad". Styled as a
// segmented control (not the underline tabs used one level down) so it
// reads as the main way to move around the panel, not a peer of the
// sub-tabs underneath it.
function SectionNav({
  section,
  onChange,
}: {
  section: "creatividad" | "activos" | "campanas";
  onChange: (section: "creatividad" | "activos" | "campanas") => void;
}) {
  return (
    <div className="wit-glass mt-8 inline-flex gap-1 rounded-2xl p-1 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            section === s.id
              ? "bg-wit-blue text-white"
              : "text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// "Campañas" doesn't exist yet — Meta ads is a whole separate technical
// track (connecting an ad account, App Review, etc.) tackled later on its
// own. This is the fully-designed placeholder so the rest of the panel
// restructure can ship now without pretending the feature is live.
function CampanasComingSoon() {
  return (
    <div className="wit-glass flex flex-col items-center gap-4 rounded-3xl px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wit-blue/10 text-wit-blue">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
          <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />
        </svg>
      </span>
      <p className="text-lg font-bold text-wit-ink">Campañas</p>
      <p className="max-w-sm text-sm text-wit-gray">
        Muy pronto vas a poder conectar tu cuenta publicitaria y lanzar pauta directo desde aquí,
        usando las piezas que ya creaste con nosotros.
      </p>
      <span className="rounded-full bg-wit-mist/60 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-wit-gray">
        Estará disponible próximamente
      </span>
    </div>
  );
}

/* ---------- activos de marca ---------- */

// cooldownLastChangedAt is only passed for the Logotipo card (never Manual
// de marca — that's not part of the "one membership, one business" abuse
// this rate limit guards against). When present, replacing an existing
// file goes through a confirm step with the 30-day-cooldown notice instead
// of jumping straight to a file picker; a first-ever upload (fileKey still
// null) is always immediate regardless.
// Used only by Manual de marca now — freely upload/replace any time, no
// restrictions. Logotipo has its own dedicated LogoCard below instead: the
// logo stays fixed once set, changed only by asking support.
function BrandAssetCard({
  title,
  description,
  fileKey,
  isPdf,
  onUploaded,
  uploadEndpoint,
  accept,
  acceptHint,
}: {
  title: string;
  description: string;
  fileKey: string | null;
  isPdf: boolean;
  onUploaded: () => void;
  uploadEndpoint: string;
  accept: string;
  acceptHint: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const key = await uploadReferenceFile(file);
      if (!key) {
        setError(`No pudimos subir el archivo (${acceptHint}).`);
        return;
      }
      const res = await fetch(uploadEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError("No pudimos guardar el archivo. Intenta de nuevo.");
        return;
      }
      onUploaded();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">{title}</p>
      <p className="mt-1 text-sm text-wit-gray">{description}</p>

      {fileKey ? (
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-wit-ink/10 p-4">
          {isPdf ? (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-wit-blue/10 text-wit-blue">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
          ) : (
            <img
              src={`/api/file?key=${encodeURIComponent(fileKey)}`}
              alt={title}
              className="h-16 w-16 shrink-0 rounded-xl border border-wit-ink/10 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-wit-ink">Archivo guardado</p>
            <a
              href={`/api/file?key=${encodeURIComponent(fileKey)}&download=1`}
              className="text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
            >
              Descargar
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-wit-ink/15 p-4 text-center text-sm text-wit-gray">
          Aún no tienes {title.toLowerCase()} guardado.
        </p>
      )}

      <label className="mt-4 block">
        <span className="sr-only">
          {fileKey ? `Reemplazar ${title.toLowerCase()}` : `Subir ${title.toLowerCase()}`}
        </span>
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-wit-gray file:mr-3 file:rounded-full file:border-0 file:bg-wit-blue file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-wit-blue-deep disabled:opacity-50"
        />
      </label>
      <p className="mt-1.5 text-[11px] text-wit-gray">{acceptHint}</p>
      {uploading ? <p className="mt-2 text-xs font-semibold text-wit-blue">Subiendo...</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

// Unlike colors/manual, the logo stays fixed once set — there's no upload
// control here at all. "Solicitar cambio de logotipo" is a placeholder for
// the support chat this'll eventually hand off to (not built yet); for now
// it just points the client at email instead of pretending there's a real
// flow behind it.
function LogoCard({ fileKey }: { fileKey: string | null }) {
  const [requested, setRequested] = useState(false);

  return (
    <div className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">Logotipo</p>
      <p className="mt-1 text-sm text-wit-gray">
        El logotipo que usamos en cada pieza que creamos para ti.
      </p>

      {fileKey ? (
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-wit-ink/10 p-4">
          <img
            src={`/api/file?key=${encodeURIComponent(fileKey)}`}
            alt="Logotipo"
            className="h-16 w-16 shrink-0 rounded-xl border border-wit-ink/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-wit-ink">Archivo guardado</p>
            <a
              href={`/api/file?key=${encodeURIComponent(fileKey)}&download=1`}
              className="text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
            >
              Descargar
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-wit-ink/15 p-4 text-center text-sm text-wit-gray">
          Aún no tienes logotipo guardado.
        </p>
      )}

      <button
        type="button"
        onClick={() => setRequested(true)}
        className="mt-4 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
      >
        Solicitar cambio de logotipo
      </button>
      {requested ? (
        <p className="mt-3 rounded-xl bg-wit-ice px-3.5 py-2.5 text-xs text-wit-ink">
          Muy pronto vas a poder platicar esto directo con soporte desde aquí. Mientras tanto,
          escríbenos a{" "}
          <a
            href="mailto:hola@witers.com"
            className="font-semibold text-wit-blue hover:text-wit-blue-deep"
          >
            hola@witers.com
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

// Colors are technically part of the brand manual, but the client wanted
// them manageable as their own card in this section too — not just buried
// inside a PDF. Reuses the same ColorsPicker every chat flow already uses,
// so picking/editing colors here looks and works exactly the same as
// answering the colors question anywhere else in the app.
function BrandColorsCard({ brandProfile }: { brandProfile: BrandProfile | null }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorList = (brandProfile?.brand_colors ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  async function save(value: string) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/brand-profile-colors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ colors: value }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError("No pudimos guardar tus colores. Intenta de nuevo.");
        return;
      }
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["brand-profile"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">Colores de marca</p>
      <p className="mt-1 text-sm text-wit-gray">
        Los colores que usamos en cada pieza que creamos para ti.
      </p>

      {editing ? (
        <div className="mt-5">
          <ColorsPicker onPick={(v) => void save(v)} />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mx-auto mt-3 block text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            Cancelar
          </button>
        </div>
      ) : colorList.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {colorList.map((c) => (
            <span
              key={c}
              title={c}
              className="h-9 w-9 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(5,13,40,0.15)]"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-wit-ink/15 p-4 text-center text-sm text-wit-gray">
          Aún no tienes colores de marca guardados.
        </p>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {colorList.length ? "Editar colores" : "Elegir colores"}
        </button>
      ) : null}
      {saving ? <p className="mt-2 text-xs font-semibold text-wit-blue">Guardando...</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function ActivosDeMarca({ brandProfile }: { brandProfile: BrandProfile | null }) {
  const qc = useQueryClient();

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["brand-profile"] });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <BrandColorsCard brandProfile={brandProfile} />
      <LogoCard fileKey={brandProfile?.logo_key ?? null} />
      <BrandAssetCard
        title="Manual de marca"
        description="Tus lineamientos de marca — colores, tipografías, uso del logo."
        fileKey={brandProfile?.brand_manual_key ?? null}
        isPdf={true}
        onUploaded={refresh}
        uploadEndpoint="/api/brand-profile-manual"
        accept="application/pdf"
        acceptHint="PDF, máx. 15 MB"
      />
    </div>
  );
}

/* ---------- Wit conversation (request creation) ---------- */

// Stand-in for a missing/empty title from the model's final answer —
// short enough to read as a title, not a re-statement of the whole brief.
// not a re-statement of the whole brief.
function deriveTitle(pieceBrief: string | undefined, companyName: string | undefined): string {
  const brief = (pieceBrief ?? "").trim();
  if (!brief) return `Pieza para ${companyName ?? "tu marca"}`;
  return brief.length > 60 ? `${brief.slice(0, 57).trimEnd()}...` : brief;
}

// The confirm/review box that appears in place of ChatIntakeFlow's
// AI-generated-fields box once every question is answered — same
// long-press-to-edit transcript stays live above it, so there's one way to
// correct an answer (not a second "editar" flow bolted onto this box).
function ChatReviewBox({
  answers,
  disabled,
  sendError,
  sending,
  onConfirm,
}: {
  answers: Record<string, string>;
  disabled: boolean;
  sendError: string | null;
  sending: boolean;
  onConfirm: () => void;
}) {
  const colorList = (answers.colors ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return (
    <div className="wit-glass w-full rounded-2xl p-5 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <dl className="space-y-3.5">
        <PreviewRow label="Título" value={answers.title ?? ""} />
        <PreviewRow label="Nombre comercial / empresa" value={answers.companyName ?? ""} />
        <PreviewRow label="Qué quieres que salga en esta pieza" value={answers.pieceBrief ?? ""} />
        {answers.audience ? <PreviewRow label="Público objetivo" value={answers.audience} /> : null}
        {answers.ageRanges ? <PreviewRow label="Rango de edad" value={answers.ageRanges} /> : null}
        {answers.promoPrice ? (
          <PreviewRow label="Precio o descuento" value={answers.promoPrice} />
        ) : null}
        {answers.requiredText ? (
          <PreviewRow label="Mensaje o dato extra" value={answers.requiredText} />
        ) : null}
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
            Colores de marca
          </dt>
          <dd className="mt-1.5 flex gap-2">
            {colorList.map((c) => (
              <span
                key={c}
                className="h-6 w-6 rounded-full border border-wit-ink/10"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </dd>
        </div>
        {answers.style ? <PreviewRow label="Estilo" value={answers.style} /> : null}
        <PreviewRow
          label="Formato"
          value={RATIO_LABEL[answers.aspectRatio ?? ""] ?? answers.aspectRatio ?? "Cuadrado"}
        />
        {answers.logoKey && answers.logoKey !== "Sin logotipo" ? (
          <PreviewImageRow label="Logotipo" fileKey={answers.logoKey} />
        ) : (
          <PreviewRow label="Logotipo" value="No tiene logotipo" />
        )}
        {answers.productPhotoKey ? (
          <PreviewImageRow label="Foto del producto" fileKey={answers.productPhotoKey} />
        ) : null}
      </dl>

      {sendError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{sendError}</p>
      ) : null}

      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || sending}
        className="mt-5 w-full rounded-2xl bg-wit-blue px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Enviando..." : "Confirmar y enviar"}
      </button>
    </div>
  );
}

// What the model hands back via its submit_piece_details tool call (see
// wit-chat.server.ts) — duplicated here rather than imported from that
// .server.ts file so nothing server-only ever risks getting pulled into
// the client bundle.
type WitPieceFields = {
  title: string;
  pieceType: string;
  pieceBrief: string;
  style: string;
  audience: string;
  ageRanges: string;
  aspectRatio: string;
  promoPrice: string;
  requiredText: string;
};

type WitMessage = { role: "user" | "assistant"; content: string; widget?: "aspectRatio" };

const ASPECT_RATIO_PROMPT = "¿Qué forma te imaginas para tu pieza?";

// Anything handed off from the homepage teaser (see teaser-handoff.ts)
// becomes a hidden context message — sent to the model, never rendered as
// a bubble — instead of the old skip-a-scripted-question mechanism, since
// the conversation itself is no longer a fixed question list.
function buildContextPrimer(initialAnswers?: Record<string, string>): string | null {
  if (!initialAnswers) return null;
  const bits = Object.entries(initialAnswers)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v}`);
  if (!bits.length) return null;
  return `Esto es lo que el cliente ya compartió en la página principal antes de registrarse — tómalo en cuenta, no lo preguntes de nuevo: ${bits.join("; ")}.`;
}

// Replaces the old scripted question list with a real, live back-and-forth
// with ChatGPT (via /api/wit/chat) — the model decides what to ask, infers
// the rest with its own creative/persuasive judgment, and only interrupts
// the free-form chat once, to hand off to the existing visual
// AspectRatioPicker for the format question. Company name/colors/category/
// logo never come up — those are already locked in brandProfile by the
// mandatory onboarding chat (see OnboardingGate) by the time this ever runs.
function WitConversation({
  disabled,
  onCreated,
  onClose,
  brandProfile,
  initialAnswers,
}: {
  disabled: boolean;
  onCreated: () => void;
  onClose: () => void;
  brandProfile: BrandProfile | null;
  initialAnswers?: Record<string, string>;
}) {
  const [contextPrimer] = useState(() => buildContextPrimer(initialAnswers));
  const [messages, setMessages] = useState<WitMessage[]>([
    { role: "assistant", content: "¡Hola! Cuéntame, ¿qué pieza quieres crear hoy?" },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [awaitingAspectRatio, setAwaitingAspectRatio] = useState(false);
  const [pieceFields, setPieceFields] = useState<WitPieceFields | null>(null);
  const [productPhotoKey, setProductPhotoKey] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // The client's own pick from AspectRatioPicker, trusted directly for the
  // final request — never re-derived from the model's echo of it in
  // submit_piece_details.
  const [pickedAspectRatio, setPickedAspectRatio] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, awaitingAspectRatio, pieceFields]);

  async function askWit(nextMessages: WitMessage[]) {
    setTyping(true);
    setChatError(null);
    try {
      const apiMessages = [
        ...(contextPrimer ? [{ role: "user" as const, content: contextPrimer }] : []),
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const res = await fetch("/api/wit/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: "message"; text: string }
        | { ok: true; kind: "ask_aspect_ratio" }
        | { ok: true; kind: "done"; fields: WitPieceFields }
        | { ok: false; error: string };
      if (!data.ok) {
        setChatError("Wit no está disponible en este momento. Intenta de nuevo en un momento.");
        return;
      }
      if (data.kind === "message") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else if (data.kind === "ask_aspect_ratio") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: ASPECT_RATIO_PROMPT, widget: "aspectRatio" },
        ]);
        setAwaitingAspectRatio(true);
      } else {
        setPieceFields(data.fields);
      }
    } catch {
      setChatError("No pudimos hablar con Wit. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setTyping(false);
    }
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing || pieceFields) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    void askWit(next);
  }

  // The one moment this hands off to a real picker instead of free text —
  // the client's choice both drives the visible transcript (so the model
  // sees exactly what was picked, in its own words) and is trusted
  // directly for the final request (see pickedAspectRatio above), never
  // re-derived from the model's own echo of it in submit_piece_details.
  function pickAspectRatio(value: string) {
    setAwaitingAspectRatio(false);
    setPickedAspectRatio(value);
    const label = RATIO_LABEL[value] ?? value;
    const next: WitMessage[] = [
      ...messages,
      { role: "user", content: `Elijo el formato: ${label}.` },
    ];
    setMessages(next);
    void askWit(next);
  }

  async function confirmSend() {
    if (!pieceFields) return;
    setSendError(null);
    setSending(true);
    try {
      const noLogo = !brandProfile?.logo_key;
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title:
            pieceFields.title || deriveTitle(pieceFields.pieceBrief, brandProfile?.company_name),
          companyName: brandProfile?.company_name,
          pieceBrief: pieceFields.pieceBrief,
          style: pieceFields.style || undefined,
          businessType: brandProfile?.business_type || undefined,
          aspectRatio: pickedAspectRatio ?? pieceFields.aspectRatio ?? "1:1",
          logoKey: noLogo ? undefined : (brandProfile?.logo_key ?? undefined),
          noLogo,
          productPhotoKey: productPhotoKey || undefined,
          audience: pieceFields.audience || undefined,
          ageRange: pieceFields.ageRanges || undefined,
          promoPrice: pieceFields.promoPrice || undefined,
          requiredText: pieceFields.requiredText || undefined,
          brandColors: brandProfile?.brand_colors || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; message?: string };
      if (!data.ok) {
        setSendError(
          data.error === "sin_saldo"
            ? "Ya usaste todas tus solicitudes disponibles."
            : data.error === "sin_membresia"
              ? "Necesitas una membresía activa para enviar solicitudes."
              : (data.message ?? "Revisa tus respuestas e intenta de nuevo."),
        );
        return;
      }
      onCreated();
    } catch {
      setSendError("No pudimos enviar tu solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  const reviewAnswers: Record<string, string> | null = pieceFields
    ? {
        title: pieceFields.title || deriveTitle(pieceFields.pieceBrief, brandProfile?.company_name),
        companyName: brandProfile?.company_name ?? "",
        pieceBrief: pieceFields.pieceBrief,
        audience: pieceFields.audience,
        ageRanges: pieceFields.ageRanges,
        promoPrice: pieceFields.promoPrice,
        requiredText: pieceFields.requiredText,
        colors: brandProfile?.brand_colors ?? "",
        style: pieceFields.style,
        aspectRatio: pickedAspectRatio ?? pieceFields.aspectRatio ?? "",
        logoKey: brandProfile?.logo_key ?? "Sin logotipo",
        productPhotoKey: productPhotoKey ?? "",
      }
    : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden px-5 pb-4 pt-4">
      <div className="relative flex flex-col items-center gap-1.5 pb-1 pt-1">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar chat"
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
          >
            ×
          </button>
        ) : null}
        <div className="wit-float">
          <WMark size={26} />
        </div>
        <p className="text-sm font-medium text-wit-ink">Hablando con Wit</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 py-4">
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-3">
              <ChatBubble role={m.role} text={m.content} />
              {m.widget === "aspectRatio" && awaitingAspectRatio ? (
                <AspectRatioPicker onPick={pickAspectRatio} />
              ) : null}
            </div>
          ))}
          {typing ? <ChatBubble role="assistant" typingDots /> : null}
          {chatError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {chatError}
            </p>
          ) : null}
          {pieceFields ? (
            <>
              <ChatBubble role="assistant" text="¡Listo! Revisa tu solicitud antes de enviarla:" />
              {reviewAnswers ? (
                <ChatReviewBox
                  answers={reviewAnswers}
                  disabled={disabled}
                  sendError={sendError}
                  sending={sending}
                  onConfirm={confirmSend}
                />
              ) : null}
            </>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {!pieceFields ? (
        <div className="shrink-0 border-t border-wit-ink/10 pb-4 pt-3">
          {showPhotoPicker ? (
            <div className="flex flex-col items-center gap-2">
              <ProductPhotoUploadPicker
                onPick={(key) => {
                  setProductPhotoKey(key);
                  setShowPhotoPicker(false);
                  setMessages((prev) => [
                    ...prev,
                    { role: "user", content: "Adjunté una foto de referencia del producto." },
                  ]);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPhotoPicker(false)}
                className="text-xs font-semibold text-wit-gray hover:text-wit-ink"
              >
                Cancelar
              </button>
            </div>
          ) : awaitingAspectRatio ? null : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendText(input);
                }}
                className="wit-glass flex items-center gap-2 rounded-full p-1.5 pl-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
              >
                <input
                  type="text"
                  aria-label="Tu mensaje"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={typing}
                  placeholder="Escribe tu mensaje..."
                  className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-wit-ink outline-none placeholder:text-wit-gray disabled:opacity-50"
                />
                <MicButton value={input} onChange={setInput} />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  aria-label="Enviar mensaje"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white transition-all hover:bg-wit-blue-deep disabled:opacity-40"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22 11 13 2 9 22 2Z" />
                  </svg>
                </button>
              </form>
              <button
                type="button"
                onClick={() => setShowPhotoPicker(true)}
                className="mt-2 block w-full text-center text-xs font-semibold text-wit-gray hover:text-wit-ink"
              >
                📎 Adjuntar foto de producto{productPhotoKey ? " (agregada)" : ""}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- new request form ---------- */

const STYLE_CHIPS = [
  "Minimalista",
  "Premium / Elegante",
  "Colorido",
  "Corporativo",
  "Divertido / Bold",
];
const AGE_CHIPS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const RATIO_LABEL: Record<string, string> = {
  "1:1": "Cuadrado",
  "4:3": "Horizontal 4:3",
  "16:9": "Horizontal 16:9 (banner)",
  "3:4": "Feed 3:4",
  "9:16": "Vertical 9:16 (stories)",
};
const RATIO_OPTIONS = [
  { value: "1:1", w: 1, h: 1, label: "Cuadrado" },
  { value: "4:3", w: 4, h: 3, label: "Horizontal" },
  { value: "16:9", w: 16, h: 9, label: "Banner" },
  { value: "3:4", w: 3, h: 4, label: "Feed" },
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

// Autocomplete-style suggestion shown below a field on focus, offering
// what the client typed in that same field last time. Positioned with
// inset-x-0 (not a fixed width) so it always lines up under the field
// and never overflows sideways on narrow screens.
function FieldSuggestion({ text, onPick }: { text: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-wit-ink/15 bg-white px-4 py-2.5 text-left shadow-lg hover:bg-wit-mist/40"
    >
      <span className="block text-[10px] font-bold uppercase tracking-wide text-wit-gray">
        Usaste antes
      </span>
      <span className="line-clamp-2 text-sm text-wit-ink">{text}</span>
    </button>
  );
}

const EMPTY_FORM = {
  title: "",
  companyName: "",
  productName: "",
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
  previousAnswers,
  brandProfile,
  onCreated,
}: {
  disabled: boolean;
  previousLogoKey: string | null;
  previousAnswers: PreviousAnswers | null;
  brandProfile: BrandProfile | null;
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
  const [activeSuggestion, setActiveSuggestion] = useState<keyof PreviousAnswers | null>(null);
  const logoLocked = Boolean(brandProfile?.logo_key);

  // Company name and colors are locked, not just suggested — force the
  // form's state to match instead of leaving the (disabled) fields empty.
  useEffect(() => {
    if (!brandProfile) return;
    setForm((f) =>
      f.companyName === brandProfile.company_name
        ? f
        : { ...f, companyName: brandProfile.company_name },
    );
    if (brandProfile.brand_colors) {
      const locked = brandProfile.brand_colors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      if (locked.length) setColors(locked);
    }
  }, [brandProfile]);

  function suggestionHandlers(key: keyof PreviousAnswers) {
    return {
      onFocus: () => setActiveSuggestion(key),
      onBlur: () => setTimeout(() => setActiveSuggestion((cur) => (cur === key ? null : cur)), 150),
    };
  }

  function pickSuggestion(key: keyof PreviousAnswers & keyof typeof EMPTY_FORM) {
    const value = previousAnswers?.[key];
    if (!value) return;
    setForm((f) => ({ ...f, [key]: value }));
    setActiveSuggestion(null);
  }

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
      form.pieceBrief.trim().length < 10
    ) {
      setError("Revisa los campos obligatorios: título, empresa y qué quieres en la pieza.");
      return;
    }
    if (!logoLocked && !noLogo && !useSameLogo && !logoFile) {
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
      if (logoLocked) {
        logoKey = brandProfile?.logo_key ?? undefined;
      } else if (useSameLogo && previousLogoKey) {
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
      <section className="wit-glass h-fit rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
        <h2 className="text-xl font-bold text-wit-ink">Revisa tu solicitud</h2>
        <p className="mt-1 text-sm text-wit-gray">
          Confirma que todo esté correcto antes de enviarla — usa una de tus solicitudes
          disponibles.
        </p>

        <dl className="mt-6 space-y-4">
          <PreviewRow label="Título" value={form.title} />
          <PreviewRow label="Nombre comercial / empresa" value={form.companyName} />
          {form.productName ? (
            <PreviewRow label="Nombre del producto" value={form.productName} />
          ) : null}
          <PreviewRow label="Qué quieres que salga en esta pieza" value={form.pieceBrief} />
          {form.audience ? <PreviewRow label="Público objetivo" value={form.audience} /> : null}
          {ageRanges.length ? (
            <PreviewRow label="Rango de edad" value={ageRanges.join(", ")} />
          ) : null}
          {form.promoPrice ? (
            <PreviewRow label="Precio o descuento" value={form.promoPrice} />
          ) : null}
          {form.requiredText ? (
            <PreviewRow label="Mensaje o dato extra" value={form.requiredText} />
          ) : null}
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
              logoLocked
                ? "Tu logotipo registrado"
                : noLogo
                  ? "No tiene logotipo"
                  : useSameLogo
                    ? "Mismo logotipo de tu solicitud anterior"
                    : (logoFile?.name ?? "")
            }
          />
          {productPhotoFile ? (
            <PreviewRow label="Foto del producto" value={productPhotoFile.name} />
          ) : null}
        </dl>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}

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
    <section className="wit-glass h-fit rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <h2 className="text-xl font-bold text-wit-ink">Nueva solicitud de diseño</h2>
      <p className="mt-1 text-sm text-wit-gray">
        Describe la creatividad publicitaria que necesitas y la generamos con IA. Tu solicitud se
        entrega en un máximo de 3 días hábiles.
      </p>

      <form onSubmit={goToPreview} className="mt-6 space-y-4">
        <div className="relative">
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
            {...suggestionHandlers("title")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Anuncio de lanzamiento para Instagram"
          />
          {activeSuggestion === "title" && previousAnswers?.title ? (
            <FieldSuggestion text={previousAnswers.title} onPick={() => pickSuggestion("title")} />
          ) : null}
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Sobre tu empresa
        </p>
        <div className="relative">
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
            disabled={Boolean(brandProfile)}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            {...suggestionHandlers("companyName")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue disabled:bg-wit-mist/40 disabled:text-wit-gray"
            placeholder="El nombre que va impreso en la pieza"
          />
          {brandProfile ? (
            <p className="mt-1.5 text-xs text-wit-gray">
              Tu empresa ya está registrada. Escríbenos si necesitas cambiarla.
            </p>
          ) : activeSuggestion === "companyName" && previousAnswers?.companyName ? (
            <FieldSuggestion
              text={previousAnswers.companyName}
              onPick={() => pickSuggestion("companyName")}
            />
          ) : null}
        </div>
        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Sobre este pedido
        </p>
        <div className="relative">
          <label htmlFor="rproduct" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Nombre del producto <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rproduct"
            type="text"
            maxLength={120}
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            {...suggestionHandlers("productName")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Si aplica a un producto en particular"
          />
          {activeSuggestion === "productName" && previousAnswers?.productName ? (
            <FieldSuggestion
              text={previousAnswers.productName}
              onPick={() => pickSuggestion("productName")}
            />
          ) : null}
        </div>
        <div className="relative">
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
            {...suggestionHandlers("pieceBrief")}
            className="w-full resize-y rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Describe el concepto de esta pieza: qué debe mostrar, la idea principal..."
          />
          {activeSuggestion === "pieceBrief" && previousAnswers?.pieceBrief ? (
            <FieldSuggestion
              text={previousAnswers.pieceBrief}
              onPick={() => pickSuggestion("pieceBrief")}
            />
          ) : null}
        </div>
        <div className="relative">
          <label htmlFor="raudience" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Público objetivo <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="raudience"
            type="text"
            maxLength={200}
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            {...suggestionHandlers("audience")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Ej. mujeres emprendedoras, dueños de restaurantes..."
          />
          {activeSuggestion === "audience" && previousAnswers?.audience ? (
            <FieldSuggestion
              text={previousAnswers.audience}
              onPick={() => pickSuggestion("audience")}
            />
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            Rango de edad{" "}
            <span className="font-normal text-wit-gray">(opcional, elige uno o varios)</span>
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
        <div className="relative">
          <label htmlFor="rpromo" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Precio o descuento <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rpromo"
            type="text"
            maxLength={80}
            value={form.promoPrice}
            onChange={(e) => setForm({ ...form, promoPrice: e.target.value })}
            {...suggestionHandlers("promoPrice")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Ej. $500, 20% de descuento..."
          />
          {activeSuggestion === "promoPrice" && previousAnswers?.promoPrice ? (
            <FieldSuggestion
              text={previousAnswers.promoPrice}
              onPick={() => pickSuggestion("promoPrice")}
            />
          ) : null}
        </div>
        <div className="relative">
          <label htmlFor="rreqtext" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            Mensaje o dato extra <span className="font-normal text-wit-gray">(opcional)</span>
          </label>
          <input
            id="rreqtext"
            type="text"
            maxLength={500}
            value={form.requiredText}
            onChange={(e) => setForm({ ...form, requiredText: e.target.value })}
            {...suggestionHandlers("requiredText")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder="Ej. válido hasta el 31 de julio, nombre de la promoción..."
          />
          {activeSuggestion === "requiredText" && previousAnswers?.requiredText ? (
            <FieldSuggestion
              text={previousAnswers.requiredText}
              onPick={() => pickSuggestion("requiredText")}
            />
          ) : null}
          <p className="mt-1.5 text-xs text-wit-gray">
            Si lo dejas vacío, nuestro equipo de diseño se encarga de la redacción.
          </p>
        </div>
        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Marca y estilo
        </p>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            Colores de marca{" "}
            {brandProfile ? null : (
              <span className="font-normal text-wit-gray">(hasta 3, opcional)</span>
            )}
          </p>
          {brandProfile ? (
            <div className="flex flex-wrap items-center gap-3">
              {colors.map((c) => (
                <span
                  key={c}
                  className="h-9 w-9 rounded-full border border-wit-ink/10"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <p className="text-xs text-wit-gray">Tus colores de marca ya están registrados.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {colors.map((c, i) => (
                <div
                  key={i}
                  className="relative flex items-center gap-1.5 rounded-xl border border-wit-ink/15 py-1 pl-1 pr-2"
                >
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
          )}
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
          <div className="relative mt-2">
            <input
              type="text"
              maxLength={200}
              value={STYLE_CHIPS.includes(form.style) ? "" : form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              {...suggestionHandlers("style")}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
              placeholder="U otro estilo en tus palabras..."
            />
            {activeSuggestion === "style" && previousAnswers?.style ? (
              <FieldSuggestion
                text={previousAnswers.style}
                onPick={() => pickSuggestion("style")}
              />
            ) : null}
          </div>
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">Archivos</p>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-wit-ink">Logotipo</label>
          {logoLocked ? (
            <div className="flex items-center gap-3 rounded-xl border border-wit-ink/15 px-4 py-3">
              <img
                src={`/api/file?key=${encodeURIComponent(brandProfile!.logo_key!)}`}
                alt=""
                className="h-10 w-10 rounded-lg border border-wit-ink/10 object-cover"
              />
              <p className="text-sm text-wit-gray">
                Este es tu logotipo registrado. Escríbenos si necesitas cambiarlo.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div>
          <label
            htmlFor="rproductphoto"
            className="mb-1.5 block text-sm font-semibold text-wit-ink"
          >
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
                  <RatioSwatch w={r.w} h={r.h} active={form.aspectRatio === r.value} />
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
        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}
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

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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

// Same shape as PreviewRow, but for logoKey/productPhotoKey — an actual
// thumbnail of what was uploaded reads a lot more like confirmation than
// the word "recibido" ever did.
function PreviewImageRow({ label, fileKey }: { label: string; fileKey: string }) {
  const href = `/api/file?key=${encodeURIComponent(fileKey)}`;
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">{label}</dt>
      <dd className="mt-1.5">
        <img
          src={href}
          alt={label}
          className="h-16 w-16 rounded-lg border border-wit-ink/10 object-cover"
          loading="lazy"
        />
      </dd>
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
        <div className="wit-glass rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
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
            <RequestEntry key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}

// "Completada" needs the client's attention (view/download, revise, or
// finalize) so it always shows in full. Everything else — still being
// worked on, or already closed out — collapses to a simple row, same
// declutter pattern as the designer/admin panels. Only "en_proceso" gets
// the rotating border: it's the one nobody's finished yet.
function RequestEntry({ row: r }: { row: RequestRow }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  // Owned here, not inside HistoryCard: closing the request flips its
  // status away from "completada", and that swap is exactly what unmounts
  // HistoryCard below (in favor of the collapsed row). If the survey lived
  // in HistoryCard's own state, it got wiped out before it ever rendered.
  const [showSurvey, setShowSurvey] = useState(false);

  const survey = showSurvey
    ? createPortal(
        <SatisfactionSurvey
          requestId={r.id}
          onDone={async () => {
            setShowSurvey(false);
            await qc.invalidateQueries({ queryKey: ["requests"] });
          }}
        />,
        document.body,
      )
    : null;

  if (r.status === "completada" || showSurvey) {
    return (
      <>
        <HistoryCard row={r} onDownloadFinalized={() => setShowSurvey(true)} />
        {survey}
      </>
    );
  }

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
        <HistoryCard row={r} />
      </div>
    );
  }

  const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.en_proceso;
  const latestResult = parseResults(r).at(-1) ?? null;
  const thumbHref = latestResult
    ? (latestResult.image_url ?? `/api/file?key=${encodeURIComponent(latestResult.r2_key ?? "")}`)
    : null;
  const compact = (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="wit-glass flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
    >
      {thumbHref ? (
        <img
          src={thumbHref}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-lg border border-wit-ink/10 object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-wit-ink">{r.title}</p>
        <p className="mt-0.5 text-xs text-wit-gray">
          Formato {r.aspect_ratio} ·{" "}
          {new Date(r.created_at + "Z").toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
      <span
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}
      >
        {r.status === "en_proceso" ? <Spinner cls="border-amber-600" /> : null}
        {st.label}
      </span>
    </button>
  );

  return r.status === "en_proceso" ? (
    <div className="wit-pending-glow">
      <div className="wit-pending-glow-shield">{compact}</div>
    </div>
  ) : (
    compact
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

function HistoryCard({
  row: r,
  onDownloadFinalized,
}: {
  row: RequestRow;
  onDownloadFinalized?: () => void;
}) {
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
      // Closing the request flips its status away from "completada", which
      // unmounts this very card (the parent collapses it) — so the survey
      // is owned one level up, by whatever still exists after that swap.
      if (wasCompleted && !alreadyRated) onDownloadFinalized?.();
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
    <article className="wit-glass rounded-2xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-wit-ink">{r.title}</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}
        >
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
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl bg-wit-ice/60 px-4 py-2.5"
            >
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
            // Once cerrada it's still the single, final deliverable (older
            // versions were already dropped from view/access), so the
            // client can keep opening and downloading this exact file.
            return (
              <button
                type="button"
                onClick={() => setLightbox({ src: href, download: downloadHref })}
                className="group relative block overflow-hidden rounded-xl border border-wit-ink/10"
              >
                <span className="block transition-transform duration-300 group-hover:scale-105">
                  {img}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-wit-navy/80 px-2 py-1.5 text-center text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {r.status === "completada" ? "Ver y descargar" : "Ver imagen"}
                </span>
                {r.status !== "completada" ? (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wit-blue text-[10px] font-bold text-white">
                    ✓
                  </span>
                ) : null}
              </button>
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
              Qué quieres que ajustemos ({revisionsLeft}{" "}
              {revisionsLeft === 1 ? "cambio disponible" : "cambios disponibles"})
            </label>
            <div className="relative">
              <textarea
                rows={3}
                maxLength={1000}
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                className="w-full resize-y rounded-lg border border-wit-ink/15 bg-white px-3 py-2 pr-12 text-sm outline-none focus:border-wit-blue"
                placeholder="Ej. cambiar el color de fondo a azul, agrandar el texto..."
              />
              <MicButton
                value={revisionText}
                onChange={setRevisionText}
                className="absolute bottom-2 right-2"
              />
            </div>
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
                Solicitar cambio ({revisionsLeft}{" "}
                {revisionsLeft === 1 ? "disponible" : "disponibles"})
              </button>
            ) : null}
            {msg ? <p className="w-full text-sm text-red-600">{msg}</p> : null}
          </div>
        )
      ) : null}

      {lightbox
        ? createPortal(
            <ImageLightbox
              src={lightbox.src}
              alt={r.title}
              willFinalize={r.status === "completada"}
              downloading={downloading}
              onDownload={() => downloadAndFinalize(lightbox.download)}
              onClose={() => setLightbox(null)}
            />,
            document.body,
          )
        : null}
    </article>
  );
}

function ImageLightbox({
  src,
  alt,
  willFinalize,
  downloading,
  onDownload,
  onClose,
}: {
  src: string;
  alt: string;
  willFinalize: boolean;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/90 p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-full max-w-3xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[70vh] w-auto rounded-2xl object-contain shadow-2xl"
        />
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
        {willFinalize ? (
          <p className="mt-3 max-w-xs text-center text-xs text-white/70">
            Si descargas la imagen, tu solicitud se dará por finalizada. Solo puedes descargar una
            versión.
          </p>
        ) : null}
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
            clipPath: STAR_CLIP,
            backgroundColor: "#FACC15",
            transform: "rotate(-14deg)",
            opacity: filled ? 0 : 1,
            transition: "opacity 300ms ease",
          }}
        />
        <img
          src="/assets/logo_w.png"
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-auto"
          style={{
            opacity: filled ? 1 : 0,
            transform: filled
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, -50%) scale(0.4)",
            transition: "opacity 300ms ease, transform 300ms ease",
            transitionDelay: filled ? "150ms" : "0ms",
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

// Star silhouette used for the "not picked yet" state — the picked state
// fades it out entirely in favor of the plain blue W mark, no background
// shape behind it.
const STAR_CLIP =
  "polygon(50% 0%, 55.5% 17.5%, 61% 35%, 79.5% 35%, 98% 35%, 83% 46%, 68% 57%, 73.5% 74%, 79% 91%, 64.5% 80.5%, 50% 70%, 35.5% 80.5%, 21% 91%, 26.5% 74%, 32% 57%, 17% 46%, 2% 35%, 20.5% 35%, 39% 35%, 44.5% 17.5%)";

function SatisfactionSurvey({ requestId, onDone }: { requestId: string; onDone: () => void }) {
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
    // Every rating (5 stars included) gets the same chance to leave a
    // comment now — it used to skip straight to "done" at 5.
    setStep("feedback");
    setPicking(false);
  }

  async function sendFeedback() {
    await submit(rating, feedback.trim() || undefined);
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-wit-navy/70 p-5">
      <div className="wit-glass w-full max-w-sm rounded-3xl p-7 text-center shadow-2xl">
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
            <h3 className="text-lg font-bold text-wit-ink">
              {rating === 5 ? "¿Qué fue lo que más te gustó?" : "¿Cómo podemos mejorar?"}
            </h3>
            <p className="mt-1 text-sm text-wit-gray">
              {rating === 5
                ? "Nos encantaría saber qué te encantó de tu pieza."
                : "Cuéntanos qué fue lo que no te gustó."}
            </p>
            <textarea
              rows={4}
              maxLength={1000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                rating === 5
                  ? "Tu comentario nos ayuda a seguir así (opcional)"
                  : "Tu comentario nos ayuda a mejorar (opcional)"
              }
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
                <p className="text-4xl">✨</p>
                <h3 className="mt-3 text-lg font-bold text-wit-ink">Gracias</h3>
                <p className="mt-2 text-sm text-wit-gray">
                  Nos encanta que tu pieza haya quedado tal como la imaginabas. Gracias por confiar
                  en WITERS.
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
