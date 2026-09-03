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
type WhatsAppNumber = {
  phoneNumberId: string;
  displayNumber: string;
  verifiedName: string | null;
  status: string | null;
};
type TrafficDestination = "website" | "facebook_page" | "instagram_profile" | "both_profiles";
type MessagingChannel = "whatsapp" | "messenger" | "instagram_direct";

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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
  const [trafficDestination, setTrafficDestination] = useState<TrafficDestination | null>(null);
  // Preselecting WhatsApp for "ventas" preserves the wizard's previous
  // behavior, where the WhatsApp picker was already shown by default.
  const [messagingChannels, setMessagingChannels] = useState<MessagingChannel[]>(["whatsapp"]);
  // "Audiencia" step — free-text description, resolved by Wit against
  // Meta's own real location/interest search (never invented ids).
  const [audienceDescription, setAudienceDescription] = useState("");
  const [suggestingAudience, setSuggestingAudience] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [audienceApplied, setAudienceApplied] = useState(false);
  const [audienceNotes, setAudienceNotes] = useState<string | null>(null);
  const [locationKey, setLocationKey] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const [selectedInterests, setSelectedInterests] = useState<{ id: string; name: string }[]>([]);
  const [dailyBudgetMxn, setDailyBudgetMxn] = useState(300);
  const [durationDays, setDurationDays] = useState(7);
  const [customDuration, setCustomDuration] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [message, setMessage] = useState(piece.caption?.trim() || piece.title);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppNumber[]>([]);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappNeedsReconnect, setWhatsappNeedsReconnect] = useState(false);
  const [whatsappFetchFailed, setWhatsappFetchFailed] = useState(false);
  const [saveAsDefaultWhatsApp, setSaveAsDefaultWhatsApp] = useState(false);
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

    void fetch("/api/meta/whatsapp/numbers", { credentials: "include" })
      .then((res) => res.json())
      .then(
        (data: {
          ok?: boolean;
          numbers?: WhatsAppNumber[];
          defaultNumber?: string | null;
          needsReconnect?: boolean;
        }) => {
          if (!data.ok) {
            setWhatsappFetchFailed(true);
            return;
          }
          setWhatsappNumbers(data.numbers ?? []);
          setWhatsappNeedsReconnect(Boolean(data.needsReconnect));
          const preselected =
            (data.defaultNumber &&
              (data.numbers ?? []).find((n) => n.displayNumber === data.defaultNumber)) ||
            ((data.numbers ?? []).length === 1 ? data.numbers![0] : null);
          if (preselected) setWhatsappNumber(preselected.displayNumber);
        },
      )
      .catch(() => setWhatsappFetchFailed(true))
      .finally(() => setWhatsappLoading(false));

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

  function toggleMessagingChannel(channel: MessagingChannel) {
    setMessagingChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    );
  }

  async function suggestAudience() {
    if (!audienceDescription.trim() || suggestingAudience) return;
    setSuggestingAudience(true);
    setAudienceError(null);
    try {
      const response = await fetch("/api/meta-audience-suggest", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: audienceDescription.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        location?: { key: string; name: string } | null;
        ageMin?: number | null;
        ageMax?: number | null;
        interests?: { id: string; name: string }[];
        notes?: string | null;
      };
      if (!response.ok || !data.ok) {
        setAudienceError(
          t(
            "No pudimos sugerir una audiencia. Intenta de nuevo.",
            "We couldn't suggest an audience. Try again.",
          ),
        );
        return;
      }
      if (data.location) {
        setLocationKey(data.location.key);
        setLocationLabel(data.location.name);
      }
      if (typeof data.ageMin === "number") setAgeMin(data.ageMin);
      if (typeof data.ageMax === "number") setAgeMax(data.ageMax);
      setSelectedInterests(data.interests ?? []);
      setAudienceNotes(data.notes ?? null);
      setAudienceApplied(true);
      trackCtaClick("audience_suggested");
    } finally {
      setSuggestingAudience(false);
    }
  }

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

  function continueTo(next: 2 | 3 | 4) {
    setError(null);
    if (next === 2 && !account.connected) return;
    if (next === 3) {
      if (dailyBudgetMxn < 20 || durationDays < 1) {
        setError(t("Revisa el presupuesto y la duración.", "Review the budget and duration."));
        return;
      }
      if (objective === "trafico" && !trafficDestination) {
        setError(t("Elige a dónde quieres llevar a las personas.", "Choose where to send people."));
        return;
      }
      if (objective === "trafico" && trafficDestination === "website" && !websiteUrl.trim()) {
        setError(t("Escribe la URL de tu sitio web.", "Enter your website URL."));
        return;
      }
      if ((objective === "interaccion" || objective === "ventas") && !messagingChannels.length) {
        setError(
          t(
            "Elige por dónde quieres recibir los mensajes.",
            "Choose where you want to receive the messages.",
          ),
        );
        return;
      }
      if (
        (objective === "interaccion" || objective === "ventas") &&
        messagingChannels.includes("whatsapp") &&
        !whatsappNumbers.some((n) => n.displayNumber === whatsappNumber)
      ) {
        setError(
          t(
            "Elige a qué WhatsApp quieres recibir los mensajes.",
            "Choose which WhatsApp should receive the messages.",
          ),
        );
        return;
      }
      if (!message.trim()) {
        setError(t("Escribe el texto del anuncio.", "Enter the ad copy."));
        return;
      }
      trackCtaClick("campaign_configuration_completed");
    }
    if (next === 4) {
      if (ageMin > ageMax) {
        setError(t("Revisa el rango de edad.", "Review the age range."));
        return;
      }
      trackCtaClick("audience_step_completed");
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
      if (objective === "ventas" && saveAsDefaultWhatsApp && whatsappNumber) {
        // Best-effort — a failed save here shouldn't block the campaign
        // itself, since the number was already validated for THIS
        // campaign server-side inside /api/campaigns-create.
        await fetch("/api/meta/whatsapp/default", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ displayNumber: whatsappNumber }),
        }).catch(() => {});
      }
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
          locationKey: locationLabel ? (locationKey ?? undefined) : undefined,
          radiusKm: locationLabel ? radiusKm : undefined,
          interestIds: selectedInterests.map((interest) => interest.id),
          adMessages: [message.trim()],
          trafficDestination: objective === "trafico" ? trafficDestination : undefined,
          messagingChannels:
            objective === "interaccion" || objective === "ventas" ? messagingChannels : [],
          whatsappNumber:
            (objective === "interaccion" || objective === "ventas") &&
            messagingChannels.includes("whatsapp")
              ? whatsappNumber.trim()
              : undefined,
          websiteUrl:
            objective === "trafico" && trafficDestination === "website" && websiteUrl.trim()
              ? websiteUrl.trim()
              : undefined,
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
          whatsapp_no_conectado: t(
            "No encontramos un WhatsApp Business disponible para esta página. Conecta o configura un número antes de continuar.",
            "We couldn't find a WhatsApp Business number available for this Page. Connect or set one up before continuing.",
          ),
          whatsapp_no_disponible: t(
            "Ese número de WhatsApp ya no está disponible en tu cuenta de Meta. Elige otro.",
            "That WhatsApp number is no longer available on your Meta account. Choose another one.",
          ),
          instagram_no_conectado: t(
            "No encontramos una cuenta de Instagram conectada a tu página de Facebook. Conéctala en Meta Business Suite antes de continuar.",
            "We couldn't find an Instagram account connected to your Facebook Page. Connect it in Meta Business Suite before continuing.",
          ),
          falta_destino_trafico: t(
            "Elige a dónde quieres llevar a las personas.",
            "Choose where to send people.",
          ),
          falta_canal_mensajeria: t(
            "Elige por dónde quieres recibir los mensajes.",
            "Choose where you want to receive the messages.",
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
  const trafficDestinationLabel: Record<TrafficDestination, string> = {
    website: t("Sitio web", "Website"),
    facebook_page: t("Página de Facebook", "Facebook Page"),
    instagram_profile: t("Perfil de Instagram", "Instagram profile"),
    both_profiles: t("Instagram y Facebook", "Instagram and Facebook"),
  };
  const messagingChannelLabel: Record<MessagingChannel, string> = {
    whatsapp: "WhatsApp",
    messenger: "Messenger",
    instagram_direct: "Instagram",
  };
  const destinationSummary =
    objective === "trafico"
      ? (trafficDestination && trafficDestinationLabel[trafficDestination]) || "—"
      : messagingChannels.map((c) => messagingChannelLabel[c]).join(" · ") || "—";
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
              onClick={() =>
                step > 1 && !success ? setStep((step - 1) as 1 | 2 | 3) : requestClose()
              }
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
              aria-label={t(`Paso ${step} de 4`, `Step ${step} of 4`)}
            >
              {[1, 2, 3, 4].map((number) => (
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
                {objective === "trafico" ? (
                  <fieldset>
                    <legend className="text-sm font-extrabold text-wit-ink">
                      {t(
                        "¿A dónde quieres llevar a las personas?",
                        "Where do you want to send people?",
                      )}
                    </legend>
                    <div className="mt-3 grid gap-2">
                      {(
                        [
                          ["website", t("Sitio web", "Website")],
                          ["instagram_profile", t("Perfil de Instagram", "Instagram profile")],
                          ["facebook_page", t("Página de Facebook", "Facebook Page")],
                          ["both_profiles", t("Instagram y Facebook", "Instagram and Facebook")],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${trafficDestination === value ? "border-wit-blue bg-wit-blue/[0.035]" : "border-wit-ink/8"}`}
                        >
                          <input
                            type="radio"
                            name="traffic-destination"
                            checked={trafficDestination === value}
                            onChange={() => setTrafficDestination(value)}
                            className="accent-[#1557ff]"
                          />
                          <span className="text-sm font-bold text-wit-ink">{label}</span>
                        </label>
                      ))}
                    </div>
                    {trafficDestination === "website" ? (
                      <label className="mt-3 block">
                        <span className="text-xs font-bold text-wit-gray">
                          {t("URL del sitio", "Website URL")}
                        </span>
                        <input
                          value={websiteUrl}
                          onChange={(event) => setWebsiteUrl(event.target.value)}
                          placeholder="https://"
                          className="mt-1 h-12 w-full rounded-2xl border border-wit-ink/10 px-3 text-sm"
                        />
                      </label>
                    ) : null}
                  </fieldset>
                ) : null}
                {objective === "interaccion" || objective === "ventas" ? (
                  <fieldset>
                    <legend className="text-sm font-extrabold text-wit-ink">
                      {t(
                        "¿Por dónde quieres recibir los mensajes?",
                        "Where do you want to receive the messages?",
                      )}
                    </legend>
                    <div className="mt-3 grid gap-2">
                      {(
                        [
                          ["instagram_direct", t("Instagram", "Instagram")],
                          ["messenger", t("Messenger", "Messenger")],
                          ["whatsapp", t("WhatsApp", "WhatsApp")],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${messagingChannels.includes(value) ? "border-wit-blue bg-wit-blue/[0.035]" : "border-wit-ink/8"}`}
                        >
                          <input
                            type="checkbox"
                            checked={messagingChannels.includes(value)}
                            onChange={() => toggleMessagingChannel(value)}
                            className="h-4 w-4 accent-wit-blue"
                          />
                          <span className="text-sm font-bold text-wit-ink">{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
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
                {(objective === "interaccion" || objective === "ventas") &&
                messagingChannels.includes("whatsapp") ? (
                  <div>
                    <span className="text-sm font-extrabold text-wit-ink">
                      {t(
                        "¿A qué WhatsApp quieres recibir los mensajes?",
                        "Which WhatsApp should receive the messages?",
                      )}
                    </span>
                    {whatsappLoading ? (
                      <p className="mt-2 flex items-center gap-2 text-xs text-wit-gray">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t(
                          "Buscando tus números de WhatsApp...",
                          "Looking up your WhatsApp numbers...",
                        )}
                      </p>
                    ) : whatsappFetchFailed ? (
                      <p className="mt-2 rounded-2xl border border-dashed border-wit-ink/15 p-3 text-xs text-wit-gray">
                        {t(
                          "No pudimos consultar tus números de WhatsApp. Intenta de nuevo más tarde.",
                          "We couldn't look up your WhatsApp numbers. Try again later.",
                        )}
                      </p>
                    ) : whatsappNeedsReconnect ? (
                      <div className="mt-2 rounded-2xl border border-dashed border-wit-ink/15 p-3">
                        <p className="text-xs text-wit-gray">
                          {t(
                            "Reconecta tu cuenta de Meta para ver tus números de WhatsApp Business.",
                            "Reconnect your Meta account to see your WhatsApp Business numbers.",
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={connectMeta}
                          className="mt-2 text-xs font-bold text-wit-blue"
                        >
                          {t("Reconectar Meta", "Reconnect Meta")}
                        </button>
                      </div>
                    ) : whatsappNumbers.length === 0 ? (
                      <p className="mt-2 rounded-2xl border border-dashed border-wit-ink/15 p-3 text-xs text-wit-gray">
                        {t(
                          "No encontramos un WhatsApp Business disponible para esta página. Conecta o configura un número en Meta Business Suite antes de continuar.",
                          "We couldn't find a WhatsApp Business number available for this Page. Connect or set one up in Meta Business Suite before continuing.",
                        )}
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {whatsappNumbers.map((number) => (
                          <label
                            key={number.phoneNumberId}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-sm ${
                              whatsappNumber === number.displayNumber
                                ? "border-wit-blue bg-wit-blue/[0.04]"
                                : "border-wit-ink/10"
                            }`}
                          >
                            <input
                              type="radio"
                              name="whatsapp-number"
                              checked={whatsappNumber === number.displayNumber}
                              onChange={() => setWhatsappNumber(number.displayNumber)}
                              className="h-4 w-4 accent-wit-blue"
                            />
                            <span className="min-w-0 flex-1">
                              <b className="block text-wit-ink">{number.displayNumber}</b>
                              {number.verifiedName ? (
                                <span className="block truncate text-xs text-wit-gray">
                                  {number.verifiedName}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                        {whatsappNumbers.length > 1 ? (
                          <label className="flex items-center gap-2 pt-1 text-xs text-wit-gray">
                            <input
                              type="checkbox"
                              checked={saveAsDefaultWhatsApp}
                              onChange={(event) => setSaveAsDefaultWhatsApp(event.target.checked)}
                              className="h-3.5 w-3.5 accent-wit-blue"
                            />
                            {t(
                              "Usar este número por defecto la próxima vez",
                              "Use this number by default next time",
                            )}
                          </label>
                        ) : null}
                      </div>
                    )}
                  </div>
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
          ) : step === 3 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
                {t("Audiencia", "Audience")}
              </p>
              <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
                {t("¿A quién quieres llegar?", "Who do you want to reach?")}
              </h2>
              <div className="mt-6 space-y-6">
                <label className="block">
                  <span className="text-sm font-extrabold text-wit-ink">
                    {t("Describe a quién quieres llegar", "Describe who you want to reach")}
                  </span>
                  <textarea
                    value={audienceDescription}
                    onChange={(event) => setAudienceDescription(event.target.value)}
                    rows={4}
                    maxLength={600}
                    placeholder={t(
                      "Ej. Dueños y administradores de restaurantes en CDMX, entre 28 y 50 años, interesados en emprendimiento, gastronomía y herramientas para hacer crecer su negocio.",
                      "E.g. Owners and managers of restaurants in Mexico City, ages 28-50, interested in entrepreneurship, food, and tools to grow their business.",
                    )}
                    className="mt-2 w-full resize-none rounded-2xl border border-wit-ink/10 p-3 text-sm outline-none focus:border-wit-blue"
                  />
                  <span className="mt-1.5 block text-xs text-wit-gray">
                    {t(
                      "Wit utilizará esta información para construir una audiencia compatible con Meta Ads.",
                      "Wit will use this to build an audience compatible with Meta Ads.",
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void suggestAudience()}
                  disabled={!audienceDescription.trim() || suggestingAudience}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {suggestingAudience ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {suggestingAudience
                    ? t("Wit está pensando...", "Wit is thinking...")
                    : t("Sugerir audiencia con Wit", "Suggest audience with Wit")}
                </button>
                {audienceError ? (
                  <p className="text-xs text-red-600" role="alert">
                    {audienceError}
                  </p>
                ) : null}

                <div>
                  <p className="text-sm font-extrabold text-wit-ink">
                    {audienceApplied
                      ? t("Audiencia sugerida", "Suggested audience")
                      : t("Público", "Audience")}
                  </p>
                  <div className="mt-2 rounded-2xl border border-wit-blue/20 bg-wit-blue/[0.035] p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-wit-blue" />
                      <b className="text-sm text-wit-ink">
                        {audienceApplied
                          ? t("Sugerida por Wit", "Suggested by Wit")
                          : t("Automático", "Automatic")}
                      </b>
                      {!audienceApplied ? (
                        <span className="rounded-full bg-wit-blue/10 px-2 py-1 text-[10px] font-bold text-wit-blue">
                          {t("Recomendado", "Recommended")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-wit-gray">
                      {audienceNotes ??
                        t(
                          "Meta optimizará tu audiencia para encontrar personas con mayor probabilidad de realizar la acción.",
                          "Meta will optimize your audience to find people most likely to take action.",
                        )}
                    </p>

                    <div className="mt-3">
                      <span className="text-xs font-bold text-wit-gray">
                        {t("Ubicación", "Location")}
                      </span>
                      {locationLabel ? (
                        <>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-wit-ink">{locationLabel}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLocationKey(null);
                                setLocationLabel(null);
                              }}
                              className="text-xs font-bold text-wit-gray hover:text-wit-ink"
                            >
                              {t("Quitar", "Remove")}
                            </button>
                          </div>
                          <label className="mt-2 block text-xs font-bold text-wit-gray">
                            {t(`Radio: ${radiusKm} km`, `Radius: ${radiusKm} km`)}
                            <input
                              type="range"
                              min={5}
                              max={50}
                              value={radiusKm}
                              onChange={(event) => setRadiusKm(Number(event.target.value))}
                              className="mt-1 block w-full accent-wit-blue"
                            />
                          </label>
                        </>
                      ) : (
                        <p className="mt-1 text-sm font-bold text-wit-ink">
                          {t("Todo México", "All of Mexico")}
                        </p>
                      )}
                    </div>

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

                    {selectedInterests.length ? (
                      <div className="mt-3">
                        <span className="text-xs font-bold text-wit-gray">
                          {t("Intereses", "Interests")}
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {selectedInterests.map((interest) => (
                            <span
                              key={interest.id}
                              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-wit-ink ring-1 ring-wit-ink/10"
                            >
                              {interest.name}
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedInterests((current) =>
                                    current.filter((i) => i.id !== interest.id),
                                  )
                                }
                                aria-label={t(`Quitar ${interest.name}`, `Remove ${interest.name}`)}
                                className="text-wit-gray hover:text-wit-ink"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                  [
                    objective === "trafico"
                      ? t("Destino", "Destination")
                      : t("Mensajes por", "Messages via"),
                    destinationSummary,
                  ],
                  [t("Ubicaciones", "Placements"), platforms],
                  [
                    t("Cuenta publicitaria", "Ad account"),
                    account.accountName || `ID: ${account.accountId}`,
                  ],
                  [
                    t("Público", "Audience"),
                    [
                      `${ageMin}-${ageMax}`,
                      locationLabel ?? t("Todo México", "All of Mexico"),
                      selectedInterests.length
                        ? t(
                            `${selectedInterests.length} intereses`,
                            `${selectedInterests.length} interests`,
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ],
                  ...((objective === "interaccion" || objective === "ventas") &&
                  messagingChannels.includes("whatsapp") &&
                  whatsappNumber
                    ? [["WhatsApp", whatsappNumber]]
                    : []),
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
            ) : step === 3 ? (
              <button
                type="button"
                onClick={() => continueTo(4)}
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
