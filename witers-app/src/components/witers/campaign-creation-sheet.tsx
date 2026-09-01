import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Link2,
  Loader2,
  Megaphone,
  Sparkles,
  X,
} from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { trackCtaClick } from "../../lib/track-click";

export type CampaignPiece = {
  requestId: string;
  title: string;
  caption: string | null;
  previewUrl: string | null;
  format: "imagen" | "video" | "carrusel";
};

type AccountStatus = { connected: boolean; accountId: string | null; accountName: string | null };
type SocialConnections = {
  facebook: { name: string | null } | null;
  instagram: { name: string | null } | null;
};
type AccountOption = { account_id: string; name: string; currency: string };

const RECOMMENDED_DAILY_MIN = 200;
const RECOMMENDED_DAILY_MAX = 500;

export function CampaignCreationSheet({
  piece,
  onClose,
  onCreated,
}: {
  piece: CampaignPiece;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [account, setAccount] = useState<AccountStatus>({
    connected: false,
    accountId: null,
    accountName: null,
  });
  const [social, setSocial] = useState<SocialConnections>({ facebook: null, instagram: null });
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [pendingAccounts, setPendingAccounts] = useState<AccountOption[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [objective, setObjective] = useState<"ventas" | "trafico" | "interaccion">("ventas");
  const [dailyBudgetMxn, setDailyBudgetMxn] = useState(300);
  const [durationDays, setDurationDays] = useState(7);
  const [customDuration, setCustomDuration] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [message, setMessage] = useState(piece.caption?.trim() || piece.title);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ id: number; startY: number; lastY: number; lastAt: number } | null>(
    null,
  );
  const draggingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    trackCtaClick("ad_flow_started");
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) requestClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      media.removeEventListener("change", update);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [onClose, submitting]);

  useEffect(() => {
    if (!mobile) return;
    const height = sheetRef.current?.getBoundingClientRect().height || window.innerHeight;
    setOffset(height);
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setOffset(0));
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [mobile]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/meta/ad-account/status", { credentials: "include" }).then((res) => res.json()),
      fetch("/api/social/connections", { credentials: "include" }).then((res) => res.json()),
    ])
      .then(([accountData, socialData]) => {
        if (accountData.ok) setAccount(accountData);
        if (socialData.ok && socialData.connections) setSocial(socialData.connections);
      })
      .finally(() => setLoadingAccount(false));

    const params = new URLSearchParams(window.location.search);
    const pick = params.get("meta_ads_pick");
    if (pick) {
      setPendingId(pick);
      void fetch(`/api/meta/ad-account/pending?id=${encodeURIComponent(pick)}`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data: { ok?: boolean; accounts?: AccountOption[] }) => {
          if (data.ok && data.accounts) setPendingAccounts(data.accounts);
        });
    }
  }, []);

  function connectMeta() {
    sessionStorage.setItem("witers_pending_campaign_piece", piece.requestId);
    const returnTo = `/panel?campaign_entry=${encodeURIComponent(piece.requestId)}&campaign=1`;
    window.location.assign(`/api/meta/ad-account/start?return_to=${encodeURIComponent(returnTo)}`);
  }

  async function chooseAccount(option: AccountOption) {
    if (!pendingId) return;
    const response = await fetch("/api/meta/ad-account/finalize", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingId, accountId: option.account_id }),
    });
    if (!response.ok) {
      setError(
        t("No pudimos guardar esa cuenta publicitaria.", "We couldn't save that ad account."),
      );
      return;
    }
    setAccount({ connected: true, accountId: option.account_id, accountName: option.name });
    setPendingAccounts([]);
    setPendingId(null);
    trackCtaClick("ad_account_selected");
  }

  function continueTo(next: 2 | 3) {
    setError(null);
    if (next === 2 && !account.connected) return;
    if (next === 3) {
      if (dailyBudgetMxn < 20 || durationDays < 1 || ageMin > ageMax) {
        setError(
          t(
            "Revisa el presupuesto, duración y rango de edad.",
            "Review budget, duration and age range.",
          ),
        );
        return;
      }
      if (objective === "ventas" && whatsappNumber.replace(/\D/g, "").length < 6) {
        setError(t("Escribe un número de WhatsApp válido.", "Enter a valid WhatsApp number."));
        return;
      }
      if (!message.trim()) {
        setError(t("Escribe el texto del anuncio.", "Enter the ad copy."));
        return;
      }
      trackCtaClick("campaign_configuration_completed");
    }
    setStep(next);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publishCampaign() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    trackCtaClick("campaign_reviewed");
    try {
      const response = await fetch("/api/campaigns-create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: piece.requestId,
          format: piece.format,
          objective,
          dailyBudgetMxn,
          durationDays,
          ageMin,
          ageMax,
          interestIds: [],
          adMessages: [message.trim()],
          whatsappNumber: objective === "ventas" ? whatsappNumber.trim() : undefined,
          websiteUrl: objective === "trafico" && websiteUrl.trim() ? websiteUrl.trim() : undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        trackCtaClick("campaign_creation_failed");
        const friendly: Record<string, string> = {
          cuenta_publicitaria_no_conectada: t(
            "Vuelve a conectar tu cuenta publicitaria.",
            "Reconnect your ad account.",
          ),
          pagina_no_conectada: t(
            "Conecta una página de Facebook antes de pautar.",
            "Connect a Facebook Page before advertising.",
          ),
          sin_pieza_final: t(
            "Esta pieza todavía no tiene un archivo final compatible.",
            "This piece doesn't have a compatible final file yet.",
          ),
          solicitud_no_terminada: t(
            "La pieza debe estar aprobada antes de pautarla.",
            "The piece must be approved before advertising it.",
          ),
          campana_duplicada: t(
            "Esta campaña ya se está creando. Espera un momento antes de intentarlo otra vez.",
            "This campaign is already being created. Wait a moment before trying again.",
          ),
          tiempo_agotado: t(
            "Meta tardó demasiado en responder. Intenta nuevamente.",
            "Meta took too long to respond. Try again.",
          ),
        };
        setError(
          data.message ??
            friendly[data.error ?? ""] ??
            t(
              "Meta no pudo crear la campaña. Revisa los permisos y el método de pago de la cuenta.",
              "Meta couldn't create the campaign. Check the account permissions and payment method.",
            ),
        );
        return;
      }
      setSuccess(true);
      trackCtaClick("campaign_created");
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!mobile || event.button !== 0 || submitting) return;
    pointerRef.current = {
      id: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: performance.now(),
    };
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!mobile || !pointer || pointer.id !== event.pointerId) return;
    const delta = Math.max(0, event.clientY - pointer.startY);
    if ((scrollRef.current?.scrollTop ?? 0) > 0 || delta <= 0) return;
    draggingRef.current = true;
    setDragging(true);
    pointer.lastY = event.clientY;
    pointer.lastAt = performance.now();
    setOffset(delta);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const delta = Math.max(0, event.clientY - pointer.startY);
    const velocity =
      Math.max(0, event.clientY - pointer.lastY) / Math.max(1, performance.now() - pointer.lastAt);
    pointerRef.current = null;
    setDragging(false);
    draggingRef.current = false;
    if (delta > (sheetRef.current?.clientHeight ?? 800) * 0.25 || velocity > 0.6) requestClose();
    else setOffset(0);
  }

  function requestClose() {
    if (submitting || closing) return;
    if (!mobile) {
      onClose();
      return;
    }
    setClosing(true);
    setOffset(sheetRef.current?.getBoundingClientRect().height || window.innerHeight);
    closeTimerRef.current = window.setTimeout(onClose, 300);
  }

  const investment = dailyBudgetMxn * durationDays;
  const objectiveLabel =
    objective === "ventas"
      ? t("Más mensajes", "More messages")
      : objective === "trafico"
        ? t("Más visitas", "More visits")
        : t("Más interacción", "More engagement");
  const platforms =
    [social.instagram ? "Instagram" : null, social.facebook ? "Facebook" : null]
      .filter(Boolean)
      .join(" · ") || t("Ubicaciones automáticas de Meta", "Meta automatic placements");
  const sheetHeight = sheetRef.current?.getBoundingClientRect().height || 1;
  const dragProgress = mobile ? Math.min(1, Math.max(0, offset / sheetHeight)) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] backdrop-blur-[2px]"
      style={{ backgroundColor: `rgba(5,10,25,${0.18 * (1 - dragProgress)})` }}
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-flow-title"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={`absolute inset-x-0 bottom-0 flex max-h-[96dvh] min-h-[82dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:min-h-0 md:w-[min(560px,46vw)] md:rounded-none ${dragging ? "transition-none" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0"} ${closing ? "will-change-transform" : ""}`}
        style={mobile ? { transform: `translate3d(0,${offset}px,0)` } : undefined}
      >
        <div className="relative shrink-0 border-b border-wit-ink/5 px-5 pb-4 pt-[calc(1.1rem+env(safe-area-inset-top))] md:px-7 md:pt-6">
          <span className="absolute left-1/2 top-[calc(.45rem+env(safe-area-inset-top))] h-1.5 w-11 -translate-x-1/2 rounded-full bg-wit-ink/15 md:hidden" />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (step > 1 && !success ? setStep((step - 1) as 1 | 2) : requestClose())}
              className="flex h-11 w-11 items-center justify-center rounded-full text-wit-ink hover:bg-wit-mist/50"
              aria-label={step > 1 ? t("Paso anterior", "Previous step") : t("Cerrar", "Close")}
            >
              {step > 1 && !success ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </button>
            <div
              className="flex flex-1 items-center justify-center gap-2"
              aria-label={t(`Paso ${step} de 3`, `Step ${step} of 3`)}
            >
              {[1, 2, 3].map((number) => (
                <span
                  key={number}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${number <= step ? "bg-wit-blue text-white" : "bg-wit-mist/70 text-wit-gray"}`}
                >
                  {number < step ? <Check className="h-3.5 w-3.5" /> : number}
                </span>
              ))}
            </div>
            <span className="h-11 w-11" />
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 md:px-7"
        >
          {success ? (
            <div className="flex min-h-[62dvh] flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-10 w-10" strokeWidth={2.5} />
              </span>
              <h2 id="campaign-flow-title" className="mt-6 text-2xl font-extrabold text-wit-ink">
                {t("¡Tu campaña está lista para revisión!", "Your campaign is ready for review!")}
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-wit-gray">
                {t(
                  "La creamos pausada para que puedas verificarla en Meta antes de activarla y comenzar a invertir.",
                  "We created it paused so you can review it in Meta before activating it and spending.",
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  trackCtaClick("campaign_viewed");
                  onClose();
                  window.dispatchEvent(new CustomEvent("witers-open-campaigns"));
                }}
                className="mt-8 min-h-12 w-full rounded-2xl bg-wit-blue px-5 font-bold text-white"
              >
                {t("Ver mis campañas", "View my campaigns")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setStep(1);
                }}
                className="mt-3 min-h-11 text-sm font-bold text-wit-blue"
              >
                {t("Crear otra campaña", "Create another campaign")}
              </button>
            </div>
          ) : step === 1 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
                {t("Cuenta", "Account")}
              </p>
              <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
                {t("Conecta tu cuenta publicitaria", "Connect your ad account")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-wit-gray">
                {t(
                  "Selecciona la cuenta que quieres utilizar para promocionar esta pieza.",
                  "Select the account you want to use to promote this piece.",
                )}
              </p>
              {loadingAccount ? (
                <div className="mt-7 h-28 animate-pulse rounded-2xl bg-wit-mist/50" />
              ) : pendingAccounts.length ? (
                <div className="mt-7 space-y-2">
                  {pendingAccounts.map((option) => (
                    <button
                      key={option.account_id}
                      type="button"
                      onClick={() => void chooseAccount(option)}
                      className="flex w-full items-center justify-between rounded-2xl border border-wit-ink/10 p-4 text-left hover:border-wit-blue/40"
                    >
                      <span>
                        <b className="block text-sm text-wit-ink">{option.name}</b>
                        <span className="text-xs text-wit-gray">ID: {option.account_id}</span>
                      </span>
                      <span className="h-5 w-5 rounded-full border-2 border-wit-blue" />
                    </button>
                  ))}
                </div>
              ) : account.connected ? (
                <div className="mt-7 rounded-2xl border border-wit-blue/20 bg-wit-blue/[0.035] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-wit-blue shadow-sm">
                      <Megaphone className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-sm text-wit-ink">
                        {account.accountName || t("Cuenta publicitaria de Meta", "Meta ad account")}
                      </b>
                      <span className="text-xs text-wit-gray">ID: {account.accountId}</span>
                    </span>
                    <Check className="ml-auto h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border border-wit-ink/8 p-5 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wit-blue/8 text-wit-blue">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <b className="mt-3 block text-base text-wit-ink">Meta Ads</b>
                  <p className="mt-1 text-sm text-wit-gray">
                    {t(
                      "Conecta Facebook e Instagram para crear y administrar tus campañas.",
                      "Connect Facebook and Instagram to create and manage campaigns.",
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={connectMeta}
                    className="mt-5 min-h-12 w-full rounded-2xl bg-wit-blue px-5 font-bold text-white"
                  >
                    {t("Conectar Meta", "Connect Meta")}
                  </button>
                </div>
              )}
              {(social.instagram || social.facebook) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {social.instagram ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-wit-mist/40 px-3 py-2 text-xs font-bold text-wit-ink">
                      <Instagram className="h-4 w-4 text-pink-500" />@{social.instagram.name}
                    </span>
                  ) : null}
                  {social.facebook ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-wit-mist/40 px-3 py-2 text-xs font-bold text-wit-ink">
                      <Facebook className="h-4 w-4 text-blue-600" />
                      {social.facebook.name}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ) : step === 2 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
                {t("Campaña", "Campaign")}
              </p>
              <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
                {t("Nueva campaña", "New campaign")}
              </h2>
              <div className="mt-6 space-y-6">
                <fieldset>
                  <legend className="text-sm font-extrabold text-wit-ink">
                    {t("¿Qué quieres conseguir?", "What do you want to achieve?")}
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {(
                      [
                        ["ventas", t("Más mensajes", "More messages")],
                        ["trafico", t("Más visitas", "More visits")],
                        ["interaccion", t("Más interacción", "More engagement")],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${objective === value ? "border-wit-blue bg-wit-blue/[0.035]" : "border-wit-ink/8"}`}
                      >
                        <input
                          type="radio"
                          name="objective"
                          checked={objective === value}
                          onChange={() => setObjective(value)}
                          className="accent-[#1557ff]"
                        />
                        <span className="text-sm font-bold text-wit-ink">{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="text-sm font-extrabold text-wit-ink">
                    {t("Presupuesto diario", "Daily budget")}
                  </span>
                  <div className="mt-2 flex h-13 items-center rounded-2xl border border-wit-ink/10 px-4">
                    <span className="font-bold text-wit-gray">$</span>
                    <input
                      type="number"
                      min={20}
                      value={dailyBudgetMxn}
                      onChange={(event) => setDailyBudgetMxn(Number(event.target.value))}
                      className="min-w-0 flex-1 border-0 px-2 text-base font-bold text-wit-ink outline-none"
                    />
                    <span className="text-xs font-bold text-wit-gray">MXN</span>
                  </div>
                  <span className="mt-1.5 block text-xs text-wit-gray">
                    {t(
                      `Recomendado: $${RECOMMENDED_DAILY_MIN} – $${RECOMMENDED_DAILY_MAX} MXN`,
                      `Recommended: $${RECOMMENDED_DAILY_MIN} – $${RECOMMENDED_DAILY_MAX} MXN`,
                    )}
                  </span>
                </label>
                <fieldset>
                  <legend className="text-sm font-extrabold text-wit-ink">
                    {t("Duración", "Duration")}
                  </legend>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {[3, 7, 14].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          setDurationDays(days);
                          setCustomDuration(false);
                        }}
                        className={`min-h-11 rounded-xl text-xs font-bold ${!customDuration && durationDays === days ? "bg-wit-blue text-white" : "bg-wit-mist/50 text-wit-ink"}`}
                      >
                        {days} {t("días", "days")}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomDuration(true)}
                      className={`min-h-11 rounded-xl text-xs font-bold ${customDuration ? "bg-wit-blue text-white" : "bg-wit-mist/50 text-wit-ink"}`}
                    >
                      {t("Otra", "Other")}
                    </button>
                  </div>
                  {customDuration ? (
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={durationDays}
                      onChange={(event) => setDurationDays(Number(event.target.value))}
                      className="mt-2 h-12 w-full rounded-xl border border-wit-ink/10 px-3 text-sm"
                      aria-label={t("Número de días", "Number of days")}
                    />
                  ) : null}
                </fieldset>
                <div>
                  <p className="text-sm font-extrabold text-wit-ink">{t("Público", "Audience")}</p>
                  <div className="mt-2 rounded-2xl border border-wit-blue/20 bg-wit-blue/[0.035] p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-wit-blue" />
                      <b className="text-sm text-wit-ink">{t("Automático", "Automatic")}</b>
                      <span className="rounded-full bg-wit-blue/10 px-2 py-1 text-[10px] font-bold text-wit-blue">
                        {t("Recomendado", "Recommended")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-wit-gray">
                      {t(
                        "Meta optimizará tu audiencia para encontrar personas con mayor probabilidad de realizar la acción.",
                        "Meta will optimize your audience to find people most likely to take action.",
                      )}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-xs font-bold text-wit-gray">
                        {t("Edad mínima", "Min age")}
                        <input
                          type="number"
                          min={13}
                          max={65}
                          value={ageMin}
                          onChange={(event) => setAgeMin(Number(event.target.value))}
                          className="mt-1 h-10 w-full rounded-xl border border-wit-ink/10 bg-white px-3 text-wit-ink"
                        />
                      </label>
                      <label className="text-xs font-bold text-wit-gray">
                        {t("Edad máxima", "Max age")}
                        <input
                          type="number"
                          min={13}
                          max={65}
                          value={ageMax}
                          onChange={(event) => setAgeMax(Number(event.target.value))}
                          className="mt-1 h-10 w-full rounded-xl border border-wit-ink/10 bg-white px-3 text-wit-ink"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm font-extrabold text-wit-ink">
                    {t("Texto del anuncio", "Ad copy")}
                  </span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    maxLength={500}
                    className="mt-2 w-full resize-none rounded-2xl border border-wit-ink/10 p-3 text-sm outline-none focus:border-wit-blue"
                  />
                </label>
                {objective === "ventas" ? (
                  <label className="block">
                    <span className="text-sm font-extrabold text-wit-ink">WhatsApp</span>
                    <input
                      value={whatsappNumber}
                      onChange={(event) => setWhatsappNumber(event.target.value)}
                      placeholder="521..."
                      className="mt-2 h-12 w-full rounded-2xl border border-wit-ink/10 px-3 text-sm"
                    />
                  </label>
                ) : null}
                {objective === "trafico" ? (
                  <label className="block">
                    <span className="text-sm font-extrabold text-wit-ink">
                      {t("Sitio web (opcional)", "Website (optional)")}
                    </span>
                    <input
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="https://"
                      className="mt-2 h-12 w-full rounded-2xl border border-wit-ink/10 px-3 text-sm"
                    />
                  </label>
                ) : null}
                <div className="rounded-2xl bg-wit-mist/35 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-wit-gray">{t("Presupuesto diario", "Daily budget")}</span>
                    <b className="text-wit-ink">${dailyBudgetMxn.toLocaleString()} MXN</b>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-wit-gray">{t("Duración", "Duration")}</span>
                    <b className="text-wit-ink">
                      {durationDays} {t("días", "days")}
                    </b>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-wit-ink/8 pt-3">
                    <span className="font-bold text-wit-ink">
                      {t("Inversión estimada", "Estimated investment")}
                    </span>
                    <b className="text-wit-blue">${investment.toLocaleString()} MXN</b>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
                {t("Revisar", "Review")}
              </p>
              <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
                {t("Revisar y publicar", "Review and publish")}
              </h2>
              <div className="mt-6 flex gap-4 rounded-2xl border border-wit-ink/8 p-4">
                {piece.previewUrl ? (
                  <img
                    src={piece.previewUrl}
                    alt=""
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-wit-mist/50">
                    <Megaphone className="h-6 w-6 text-wit-blue" />
                  </span>
                )}
                <div className="min-w-0">
                  <b className="block text-sm text-wit-ink">{piece.title}</b>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-wit-gray">
                    {message}
                  </p>
                </div>
              </div>
              <dl className="mt-5 divide-y divide-wit-ink/7 rounded-2xl bg-wit-mist/25 px-4">
                {[
                  [t("Objetivo", "Objective"), objectiveLabel],
                  [
                    t("Presupuesto diario", "Daily budget"),
                    `$${dailyBudgetMxn.toLocaleString()} MXN`,
                  ],
                  [t("Duración", "Duration"), `${durationDays} ${t("días", "days")}`],
                  [
                    t("Inversión estimada", "Estimated investment"),
                    `$${investment.toLocaleString()} MXN`,
                  ],
                  [t("Ubicaciones", "Placements"), platforms],
                  [
                    t("Cuenta publicitaria", "Ad account"),
                    account.accountName || `ID: ${account.accountId}`,
                  ],
                  [t("Público", "Audience"), t("Automático", "Automatic")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-xs font-semibold text-wit-gray">{label}</dt>
                    <dd className="text-right text-xs font-extrabold text-wit-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {error ? (
            <p className="mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {!success ? (
          <div className="shrink-0 border-t border-wit-ink/6 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:px-7">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => continueTo(2)}
                disabled={!account.connected || loadingAccount}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 font-bold text-white disabled:opacity-35"
              >
                {t("Continuar", "Continue")}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : step === 2 ? (
              <button
                type="button"
                onClick={() => continueTo(3)}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 font-bold text-white"
              >
                {t("Continuar", "Continue")}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void publishCampaign()}
                disabled={submitting}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 font-bold text-white disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Megaphone className="h-5 w-5" />
                )}
                {submitting
                  ? t("Creando campaña...", "Creating campaign...")
                  : t("Publicar campaña", "Publish campaign")}{" "}
                {!submitting ? <ChevronRight className="h-4 w-4" /> : null}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
