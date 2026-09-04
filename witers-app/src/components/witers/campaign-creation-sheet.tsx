import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Facebook, Instagram, Link2, Loader2, Megaphone } from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { trackCtaClick } from "../../lib/track-click";
import { AdsAudienceStep } from "./ads-wizard/ads-audience-step";
import { AdsBudgetStep } from "./ads-wizard/ads-budget-step";
import { AdsCreationProgress } from "./ads-wizard/ads-creation-progress";
import { AdsCreativeStep } from "./ads-wizard/ads-creative-step";
import { AdsDestinationStep } from "./ads-wizard/ads-destination-step";
import { AdsDurationStep } from "./ads-wizard/ads-duration-step";
import { AdsObjectiveStep } from "./ads-wizard/ads-objective-step";
import { AdsPreparationStep } from "./ads-wizard/ads-preparation-step";
import { AdsReviewStep } from "./ads-wizard/ads-review-step";
import { AdsWizardHeader } from "./ads-wizard/ads-wizard-header";
import type {
  AccountOption,
  AccountStatus,
  AudienceMode,
  BrandLite,
  CampaignPiece,
  MessagingChannel,
  Objective,
  SavedAudience,
  SocialConnections,
  TrafficDestination,
  WhatsAppNumber,
  WizardStepId,
} from "./ads-wizard/types";

export type { CampaignPiece } from "./ads-wizard/types";

// The wizard's own navigable order — "preparacion" is skipped at runtime
// (never removed from here) when the ad account is already connected;
// "creando" is reached only from publishCampaign(), never via Continue.
const STEP_FLOW: WizardStepId[] = [
  "preparacion",
  "objetivo",
  "destino",
  "presupuesto",
  "duracion",
  "audiencia",
  "creativo",
  "revision",
];

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
  const [step, setStep] = useState<WizardStepId>("preparacion");
  const skipCheckedRef = useRef(false);
  const [account, setAccount] = useState<AccountStatus>({
    connected: false,
    accountId: null,
    accountName: null,
  });
  const [social, setSocial] = useState<SocialConnections>({ facebook: null, instagram: null });
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [pendingAccounts, setPendingAccounts] = useState<AccountOption[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandLite>({ companyName: null, logoUrl: null });
  const [objective, setObjective] = useState<Objective>("ventas");
  const [trafficDestination, setTrafficDestination] = useState<TrafficDestination | null>(null);
  const [messagingChannels, setMessagingChannels] = useState<MessagingChannel[]>(["whatsapp"]);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(null);
  const [audienceDescription, setAudienceDescription] = useState("");
  const [suggestingAudience, setSuggestingAudience] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [audienceApplied, setAudienceApplied] = useState(false);
  const [audienceNotes, setAudienceNotes] = useState<string | null>(null);
  const [locationKey, setLocationKey] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const [selectedInterests, setSelectedInterests] = useState<{ id: string; name: string }[]>([]);
  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[]>([]);
  const [showSaveAudience, setShowSaveAudience] = useState(false);
  const [saveAudienceName, setSaveAudienceName] = useState("");
  const [savingAudience, setSavingAudience] = useState(false);
  const [dailyBudgetMxn, setDailyBudgetMxn] = useState(300);
  const [durationDays, setDurationDays] = useState(7);
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
  const [creationStatus, setCreationStatus] = useState<"creating" | "success" | "error">(
    "creating",
  );
  const [error, setError] = useState<string | null>(null);
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [activatedResult, setActivatedResult] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
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
      if (event.key === "Escape" && creationStatus !== "creating") requestClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      media.removeEventListener("change", update);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    void fetch("/api/meta-audience-saved", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; audiences?: SavedAudience[] }) => {
        if (data.ok) setSavedAudiences(data.audiences ?? []);
      })
      .catch(() => {});

    // Only used for the ad preview's identity row (Paso 6) — same
    // endpoint every other brand-profile read in the app already uses.
    void fetch("/api/brand-profile", { credentials: "include" })
      .then((res) => res.json())
      .then(
        (data: {
          ok?: boolean;
          profile?: { company_name?: string | null; logo_key?: string | null } | null;
        }) => {
          if (data.ok && data.profile) {
            setBrand({
              companyName: data.profile.company_name ?? null,
              logoUrl: data.profile.logo_key
                ? `/api/file?key=${encodeURIComponent(data.profile.logo_key)}`
                : null,
            });
          }
        },
      )
      .catch(() => {});

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

  // Paso 0 auto-skip — "Si la cuenta ya está preparada, este paso debe
  // poder saltarse automáticamente." The ad account connection is the
  // one real hard requirement every later step depends on (same gate the
  // old wizard's step 1 used); Facebook/Instagram/WhatsApp are still
  // shown on this screen for anyone who *does* land on it, but were
  // never a hard gate before either.
  useEffect(() => {
    if (loadingAccount || skipCheckedRef.current) return;
    skipCheckedRef.current = true;
    if (account.connected && step === "preparacion") setStep("objetivo");
  }, [loadingAccount, account.connected, step]);

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

  function applySavedAudience(audience: SavedAudience) {
    setAgeMin(audience.ageMin);
    setAgeMax(audience.ageMax);
    setLocationKey(audience.locationKey);
    setLocationLabel(audience.locationLabel);
    if (audience.radiusKm) setRadiusKm(audience.radiusKm);
    setSelectedInterests(audience.interests);
    setAudienceNotes(audience.notes);
    setAudienceApplied(true);
    trackCtaClick("audience_reused");
  }

  async function saveAudience() {
    if (!saveAudienceName.trim() || savingAudience) return;
    setSavingAudience(true);
    try {
      const response = await fetch("/api/meta-audience-saved", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: saveAudienceName.trim(),
          description: audienceDescription.trim() || saveAudienceName.trim(),
          ageMin,
          ageMax,
          locationKey,
          locationLabel,
          radiusKm: locationLabel ? radiusKm : null,
          interests: selectedInterests,
          notes: audienceNotes,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string };
      if (response.ok && data.ok && data.id) {
        setSavedAudiences((current) => [
          {
            id: data.id!,
            name: saveAudienceName.trim(),
            description: audienceDescription.trim() || saveAudienceName.trim(),
            ageMin,
            ageMax,
            locationKey,
            locationLabel,
            radiusKm: locationLabel ? radiusKm : null,
            interests: selectedInterests,
            notes: audienceNotes,
          },
          ...current,
        ]);
        setSaveAudienceName("");
        setShowSaveAudience(false);
        trackCtaClick("audience_saved");
      }
    } finally {
      setSavingAudience(false);
    }
  }

  function connectMeta() {
    sessionStorage.setItem("witers_pending_campaign_piece", piece.requestId);
    const returnTo = `/panel?campaign_entry=${encodeURIComponent(piece.requestId)}&campaign=1`;
    window.location.assign(`/api/meta/ad-account/start?return_to=${encodeURIComponent(returnTo)}`);
  }

  // Instagram Direct/Messenger destinations and IG/FB traffic depend on
  // social_connections (a different OAuth than the ads account — see
  // /api/social/connect/start's own comment). Real, functional, but a
  // full-page redirect: unlike connectMeta() above, this callback has no
  // return_to support, so the wizard doesn't resume its exact step after
  // — a known gap, not a fabricated success.
  function connectSocial() {
    window.location.assign("/api/social/connect/start");
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

  const flowIndex = STEP_FLOW.indexOf(step);
  const hasProgress = flowIndex > STEP_FLOW.indexOf("objetivo");

  function goTo(next: WizardStepId) {
    setError(null);
    setStep(next);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateStep(current: WizardStepId): string | null {
    if (current === "destino") {
      if (objective === "trafico") {
        if (!trafficDestination) {
          return t("Elige a dónde quieres llevar a las personas.", "Choose where to send people.");
        }
        if (trafficDestination === "website" && !websiteUrl.trim()) {
          return t("Escribe la URL de tu sitio web.", "Enter your website URL.");
        }
      }
      if (objective === "ventas") {
        if (!messagingChannels.length) {
          return t(
            "Elige por dónde quieres recibir los mensajes.",
            "Choose where you want to receive the messages.",
          );
        }
        if (
          messagingChannels.includes("whatsapp") &&
          !whatsappNumbers.some((n) => n.displayNumber === whatsappNumber)
        ) {
          return t(
            "Elige a qué WhatsApp quieres recibir los mensajes.",
            "Choose which WhatsApp should receive the messages.",
          );
        }
      }
    }
    if (current === "presupuesto" && dailyBudgetMxn < 20) {
      return t("Revisa tu presupuesto diario.", "Review your daily budget.");
    }
    if (current === "duracion" && durationDays < 1) {
      return t("Revisa la duración de tu campaña.", "Review your campaign's duration.");
    }
    if (current === "audiencia" && ageMin > ageMax) {
      return t("Revisa el rango de edad.", "Review the age range.");
    }
    if (current === "creativo" && !message.trim()) {
      return t("Escribe el texto del anuncio.", "Enter the ad copy.");
    }
    return null;
  }

  function continueFrom(current: WizardStepId) {
    const problem = validateStep(current);
    if (problem) {
      setError(problem);
      return;
    }
    const index = STEP_FLOW.indexOf(current);
    const next = STEP_FLOW[index + 1];
    if (!next) return;
    if (current === "destino") trackCtaClick("campaign_configuration_completed");
    if (current === "audiencia") trackCtaClick("audience_step_completed");
    goTo(next);
  }

  function goBack() {
    const index = STEP_FLOW.indexOf(step);
    // Never step back into "preparacion" once the account was already
    // connected at mount — there's nothing to review there.
    const prev = STEP_FLOW[Math.max(index - 1, account.connected ? 1 : 0)];
    goTo(prev);
  }

  async function publishCampaign() {
    if (creationStatus === "creating" && step === "creando") return;
    setError(null);
    setStep("creando");
    setCreationStatus("creating");
    trackCtaClick("campaign_reviewed");
    try {
      if (objective === "ventas" && saveAsDefaultWhatsApp && whatsappNumber) {
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
          idempotencyKey: idempotencyKeyRef.current,
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
          messagingChannels: objective === "ventas" ? messagingChannels : [],
          whatsappNumber:
            objective === "ventas" && messagingChannels.includes("whatsapp")
              ? whatsappNumber.trim()
              : undefined,
          websiteUrl:
            objective === "trafico" && trafficDestination === "website" && websiteUrl.trim()
              ? websiteUrl.trim()
              : undefined,
          activateImmediately,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        activated?: boolean;
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
          campana_en_proceso: t(
            "Esta campaña todavía se está creando. Espera un momento antes de intentarlo otra vez.",
            "This campaign is still being created. Wait a moment before trying again.",
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
        setCreationStatus("error");
        return;
      }
      setActivatedResult(Boolean(data.activated));
      setCreationStatus("success");
      trackCtaClick(data.activated ? "campaign_created_active" : "campaign_created");
      onCreated?.();
    } catch {
      setError(
        t(
          "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
          "We couldn't reach the server. Check your connection and try again.",
        ),
      );
      setCreationStatus("error");
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!mobile || event.button !== 0 || step === "creando") return;
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
    if (step === "creando" && creationStatus === "creating") return;
    if (closing) return;
    // "Cerrar accidentalmente el wizard debe manejarse de forma segura"
    // — once real decisions exist (past Paso 1), confirm before throwing
    // them away instead of silently discarding.
    if (hasProgress && creationStatus !== "success" && step !== "creando") {
      const ok = window.confirm(
        t(
          "¿Cerrar sin terminar? Perderás la configuración de esta campaña.",
          "Close without finishing? You'll lose this campaign's setup.",
        ),
      );
      if (!ok) return;
    }
    if (!mobile) {
      onClose();
      return;
    }
    setClosing(true);
    setOffset(sheetRef.current?.getBoundingClientRect().height || window.innerHeight);
    closeTimerRef.current = window.setTimeout(onClose, 300);
  }

  const objectiveLabel =
    objective === "ventas" ? t("Mensajes", "Messages") : t("Clientes", "Customers");
  const platforms =
    [social.instagram ? "Instagram" : null, social.facebook ? "Facebook" : null]
      .filter(Boolean)
      .join(" · ") || t("Ubicaciones automáticas de Meta", "Meta automatic placements");
  const trafficDestinationLabel: Record<TrafficDestination, string> = {
    website: t("Sitio web", "Website"),
    facebook_page: t("Página de Facebook", "Facebook Page"),
    instagram_profile: t("Perfil de Instagram", "Instagram profile"),
  };
  const messagingChannelLabel: Record<MessagingChannel, string> = {
    whatsapp: "WhatsApp",
    messenger: "Messenger",
    instagram_direct: "Instagram",
  };
  const destinationLabel =
    objective === "trafico"
      ? (trafficDestination && trafficDestinationLabel[trafficDestination]) || "—"
      : messagingChannels.map((c) => messagingChannelLabel[c]).join(" · ") || "—";
  const destinationSub =
    objective === "trafico"
      ? trafficDestination === "website" && websiteUrl
        ? websiteUrl
        : null
      : messagingChannels.includes("whatsapp") && whatsappNumber
        ? whatsappNumber
        : null;
  const ctaLabel =
    objective === "trafico"
      ? t("Más información", "Learn more")
      : messagingChannels.length === 1 && messagingChannels[0] === "whatsapp"
        ? t("Enviar mensaje por WhatsApp", "Send WhatsApp message")
        : t("Enviar mensaje", "Send message");
  const audienceLabel =
    [
      locationLabel ?? t("Todo México", "All of Mexico"),
      `${ageMin}-${ageMax}`,
      selectedInterests.length
        ? t(`${selectedInterests.length} intereses`, `${selectedInterests.length} interests`)
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || t("Todo México", "All of Mexico");
  const audienceSummary =
    [
      locationLabel,
      `${ageMin}-${ageMax} años`,
      selectedInterests.length ? selectedInterests.map((i) => i.name).join(", ") : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  const sheetHeight = sheetRef.current?.getBoundingClientRect().height || 1;
  const dragProgress = mobile ? Math.min(1, Math.max(0, offset / sheetHeight)) : 0;
  const canGoBack = STEP_FLOW.indexOf(step) > (account.connected ? 1 : 0) && step !== "creando";

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
        {step === "creando" ? null : (
          <AdsWizardHeader
            step={step}
            onBack={goBack}
            onClose={requestClose}
            canGoBack={canGoBack}
          />
        )}

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 md:px-7"
        >
          {step === "creando" ? (
            <AdsCreationProgress
              status={creationStatus}
              errorMessage={error}
              activated={activatedResult}
              onViewCampaign={() => {
                trackCtaClick("campaign_viewed");
                onClose();
                window.dispatchEvent(new CustomEvent("witers-open-campaigns"));
              }}
              onDone={onClose}
              onRetry={() => {
                setError(null);
                setStep("revision");
              }}
            />
          ) : step === "preparacion" ? (
            <div>
              <AdsPreparationStep
                loadingAccount={loadingAccount}
                account={account}
                social={social}
                whatsappLoading={whatsappLoading}
                whatsappFetchFailed={whatsappFetchFailed}
                whatsappCount={whatsappNumbers.length}
                onConnectMeta={connectMeta}
              />
              {pendingAccounts.length ? (
                <div className="mt-5 space-y-2">
                  <p className="text-sm font-extrabold text-wit-ink">
                    {t("Elige tu cuenta publicitaria", "Choose your ad account")}
                  </p>
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
              ) : !loadingAccount && !account.connected ? (
                <div className="mt-5 rounded-2xl border border-wit-ink/8 p-5 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wit-blue/8 text-wit-blue">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <b className="mt-3 block text-base text-wit-ink">Meta Ads</b>
                  <p className="mt-1 text-sm text-wit-gray">
                    {t(
                      "Conecta tu cuenta publicitaria para poder crear campañas.",
                      "Connect your ad account to start creating campaigns.",
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
              ) : null}
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
          ) : step === "objetivo" ? (
            <AdsObjectiveStep objective={objective} onSelect={setObjective} />
          ) : step === "destino" ? (
            <AdsDestinationStep
              objective={objective}
              trafficDestination={trafficDestination}
              onSelectTrafficDestination={setTrafficDestination}
              websiteUrl={websiteUrl}
              onWebsiteUrlChange={setWebsiteUrl}
              messagingChannels={messagingChannels}
              onToggleMessagingChannel={toggleMessagingChannel}
              social={social}
              whatsappNumber={whatsappNumber}
              onWhatsappNumberChange={setWhatsappNumber}
              whatsappNumbers={whatsappNumbers}
              whatsappLoading={whatsappLoading}
              whatsappFetchFailed={whatsappFetchFailed}
              whatsappNeedsReconnect={whatsappNeedsReconnect}
              onConnectMeta={connectMeta}
              onConnectSocial={connectSocial}
            />
          ) : step === "presupuesto" ? (
            <AdsBudgetStep dailyBudgetMxn={dailyBudgetMxn} onChange={setDailyBudgetMxn} />
          ) : step === "duracion" ? (
            <AdsDurationStep
              durationDays={durationDays}
              onChange={setDurationDays}
              dailyBudgetMxn={dailyBudgetMxn}
            />
          ) : step === "audiencia" ? (
            <AdsAudienceStep
              audienceMode={audienceMode}
              onSetAudienceMode={setAudienceMode}
              audienceDescription={audienceDescription}
              onAudienceDescriptionChange={setAudienceDescription}
              onSuggestAudience={() => void suggestAudience()}
              suggestingAudience={suggestingAudience}
              audienceError={audienceError}
              audienceApplied={audienceApplied}
              audienceNotes={audienceNotes}
              locationKey={locationKey}
              locationLabel={locationLabel}
              onSetLocation={(key, label) => {
                setLocationKey(key);
                setLocationLabel(label);
              }}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
              ageMin={ageMin}
              ageMax={ageMax}
              onAgeMinChange={setAgeMin}
              onAgeMaxChange={setAgeMax}
              selectedInterests={selectedInterests}
              onAddInterest={(interest) =>
                setSelectedInterests((current) =>
                  current.some((i) => i.id === interest.id) ? current : [...current, interest],
                )
              }
              onRemoveInterest={(id) =>
                setSelectedInterests((current) => current.filter((i) => i.id !== id))
              }
              savedAudiences={savedAudiences}
              onApplySavedAudience={applySavedAudience}
              showSaveAudience={showSaveAudience}
              onShowSaveAudience={() => setShowSaveAudience(true)}
              saveAudienceName={saveAudienceName}
              onSaveAudienceNameChange={setSaveAudienceName}
              onSaveAudience={() => void saveAudience()}
              savingAudience={savingAudience}
            />
          ) : step === "creativo" ? (
            <AdsCreativeStep
              piece={piece}
              brand={brand}
              objective={objective}
              message={message}
              onMessageChange={setMessage}
              ctaLabel={ctaLabel}
              audienceSummary={audienceSummary}
            />
          ) : (
            <AdsReviewStep
              piece={piece}
              objectiveLabel={objectiveLabel}
              destinationLabel={destinationLabel}
              destinationSub={destinationSub}
              audienceLabel={audienceLabel}
              dailyBudgetMxn={dailyBudgetMxn}
              durationDays={durationDays}
              message={message}
              activateImmediately={activateImmediately}
              onActivateImmediatelyChange={setActivateImmediately}
              onEditStep={goTo}
            />
          )}
          {error && step !== "creando" ? (
            <p className="mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {step !== "creando" ? (
          <div className="shrink-0 border-t border-wit-ink/6 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:px-7">
            {step === "preparacion" ? (
              <button
                type="button"
                onClick={() => continueFrom("preparacion")}
                disabled={!account.connected || loadingAccount}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 font-bold text-white disabled:opacity-35"
              >
                {t("Continuar", "Continue")}
              </button>
            ) : step === "revision" ? (
              <button
                type="button"
                onClick={() => void publishCampaign()}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 font-bold text-white"
              >
                <Megaphone className="h-5 w-5" />
                {t("Crear campaña", "Create campaign")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => continueFrom(step)}
                // CAMBIO 02 (Fase 2.7) — the presupuesto step is the one
                // place a client can type their way into an invalid value
                // (every other step only offers pre-validated choices), so
                // it's the one place Continuar needs to react to that
                // before the click, not just after — reusing the same
                // real minimum (20) validateStep already enforces.
                disabled={step === "presupuesto" && dailyBudgetMxn < 20}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("Continuar", "Continue")}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
