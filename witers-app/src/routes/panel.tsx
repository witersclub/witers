import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type * as LeafletNS from "leaflet";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpCircle,
  BookOpen,
  Briefcase,
  Building2,
  Cake,
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Dumbbell,
  Eye,
  FileDown,
  FileText,
  Flame,
  GalleryHorizontal,
  Globe,
  Home,
  Image as ImageIcon,
  Images,
  Laptop,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Magnet,
  MapPin,
  Megaphone,
  MessageCircle,
  PackagePlus,
  PawPrint,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Rocket,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  User,
  Users,
  UtensilsCrossed,
  Video as VideoIcon,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { WitersLogo, WMark } from "../components/witers/brand";
import { ChatBubble, ChatIntakeFlow } from "../components/witers/chat-intake";
import { MicButton } from "../components/witers/mic-button";
import { PasswordInput } from "../components/witers/password-input";
import {
  AspectRatioPicker,
  BusinessTypeWheel,
  ColorsPicker,
  LogoUploadPicker,
  uploadReferenceFile,
} from "../components/witers/lab-pickers";
import {
  VideoLandingScreen,
  VideoRequestList,
  VideoWizard,
  type VideoRequestRow,
} from "../components/witers/video-requests";
import {
  CarouselLandingScreen,
  CarouselRequestList,
  CarouselWizard,
  parseSlides,
  type CarouselRequestRow,
} from "../components/witers/carousel-requests";
import { IMAGE_PACKS } from "../lib/image-packs";
import { useLanguage, LanguageToggle } from "../lib/i18n";
import { getPlan } from "../lib/membership-plans";
import { consumeTeaserAnswers } from "../lib/teaser-handoff";
import { useMe, type Me } from "../lib/witers-client";
import {
  buildAllCampaignsReportPdf,
  downloadPdf,
  type ReportAd,
  type ReportCampaignSummary,
  type ReportCampaignSection,
} from "../lib/campaign-report-pdf";
import type { CampaignRange } from "../components/witers/campaign-date-range-picker";

export const Route = createFileRoute("/panel")({
  head: () => ({
    meta: [
      { title: "Mi panel. WITERS" },
      { name: "description", content: "Tu panel de solicitudes de diseño WITERS." },
    ],
    // Preloads the splash's W mark before PanelSplashIntro ever mounts —
    // without this, the browser only starts fetching that PNG once the
    // component renders it, and on a slow/uncached load the fade-in
    // animation can finish (mark fully opaque) before the image itself has
    // actually painted, which reads as a brief flicker/pop rather than a
    // clean fade.
    links: [{ rel: "preload", as: "image", href: "/assets/logo_w.png" }],
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
  change_request_note: string | null;
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
  // Facebook Page this client pautas from — set only by an admin. Null
  // means "Quiero pautar" stays blocked for them (see PautarButton).
  meta_page_id: string | null;
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

const STATUS_LABEL: Record<string, { es: string; en: string; cls: string }> = {
  en_proceso: { es: "En proceso", en: "In progress", cls: "bg-amber-50 text-amber-700" },
  completada: { es: "Completada", en: "Completed", cls: "bg-emerald-50 text-emerald-700" },
  cerrada: { es: "✓ Finalizada", en: "✓ Finished", cls: "bg-wit-blue/10 text-wit-blue" },
  rechazada: { es: "Rechazada", en: "Rejected", cls: "bg-red-50 text-red-600" },
  cambio_solicitado: {
    es: "Cambio en revisión",
    en: "Change under review",
    cls: "bg-amber-50 text-amber-700",
  },
};

// Consecutive weeks (counting back from the current one) with at least one
// request — a gap of even one week breaks it. "Week" here is just "N*7
// days ago," not a calendar week, so it doesn't reset on some arbitrary
// day for no reason a client would notice.
function computeStreakWeeks(createdAtDates: string[]): number {
  const now = Date.now();
  const weekBuckets = new Set(
    createdAtDates
      .map((d) => {
        const t = new Date(d + "Z").getTime();
        return Number.isNaN(t) ? null : Math.floor((now - t) / (7 * 24 * 60 * 60 * 1000));
      })
      .filter((w): w is number => w !== null && w >= 0),
  );
  let streak = 0;
  while (weekBuckets.has(streak)) streak++;
  return streak;
}

// A ring "drains" as the month's requests get used — full circle at the
// start of the cycle, empty once nothing's left — instead of a plain
// used/total line. Each content type gets its own brand color so all three
// read as distinct at a glance (matches the Imágenes/Video/Carrusel colors
// already used on the "Crear ___" cards below).
//
// A plan that doesn't include this content type still shows its ring —
// hiding it entirely reads as "this doesn't exist," not "you don't have
// it yet." Locked keeps the same brand color (just dimmed) rather than a
// neutral gray, and swaps the content icon for a lock; tapping it opens
// the upgrade teaser instead of showing a fraction that's always "0/0."
function QuotaRing({
  icon: Icon,
  remaining,
  quota,
  colorHex,
  label,
  locked,
  onLockedClick,
}: {
  icon: LucideIcon;
  remaining: number;
  quota: number;
  colorHex: string;
  label: string;
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = locked ? 1 : quota > 0 ? Math.max(0, Math.min(1, remaining / quota)) : 0;
  const offset = circumference * (1 - pct);

  const content = (
    <>
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#E4E9F7" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={colorHex}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            opacity={locked ? 0.3 : 1}
            style={{ transition: "stroke-dashoffset 400ms ease" }}
          />
        </svg>
        {locked ? (
          <Lock className="h-4.5 w-4.5" style={{ color: colorHex }} strokeWidth={2.2} />
        ) : (
          <Icon className="h-5 w-5" style={{ color: colorHex }} strokeWidth={2} />
        )}
      </div>
      {locked ? (
        <p className="text-[10px] font-semibold text-wit-gray">{label}</p>
      ) : (
        <>
          <p className="font-wit-mono text-sm font-bold text-wit-ink">
            {Math.max(0, remaining)}
            <span className="text-wit-gray">/{quota}</span>
          </p>
          <p className="text-[10px] font-semibold text-wit-gray">{label}</p>
        </>
      )}
    </>
  );

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
      >
        {content}
      </button>
    );
  }
  return <div className="flex flex-col items-center gap-1.5">{content}</div>;
}

// Opens from tapping a locked quota ring — same centered-card pattern as
// ImagePacksModal. Copy pulls the plan name/quota straight from
// membership-plans.ts rather than a hardcoded "Grow, 2 videos" string, so
// it never drifts if a plan's numbers change.
function UpgradeTeaser({
  icon: Icon,
  colorHex,
  title,
  body,
  onClose,
}: {
  icon: LucideIcon;
  colorHex: string;
  title: string;
  body: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-3xl bg-white p-7 text-center shadow-[0_30px_80px_rgba(5,13,40,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${colorHex}1a` }}
        >
          <Icon className="h-7 w-7" style={{ color: colorHex }} strokeWidth={2} />
        </span>
        <p className="mt-4 text-lg font-bold text-wit-ink">{title}</p>
        <p className="mt-2 text-sm text-wit-gray">{body}</p>
        <Link
          to="/upgrade"
          className="mt-6 flex items-center justify-center gap-1.5 rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-wit-blue-deep"
        >
          <ArrowUpCircle className="h-4 w-4" strokeWidth={2.4} />
          {t("Hacer upgrade", "Upgrade")}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          {t("Cerrar", "Close")}
        </button>
      </div>
    </div>
  );
}

const PANEL_SPLASH_MS = 1300;
const PANEL_SPLASH_SESSION_KEY = "wit_panel_splash_shown";

// useEffect fires after the browser has already painted, so deciding
// showSplash there left a visible gap — one frame (or more, on a slow
// device) showing whatever was underneath (the profile-loading skeleton)
// before the splash caught up and covered it. useLayoutEffect flushes
// synchronously before paint, closing that gap; it only needs to be
// conditional so SSR (no DOM, so no layout effects) doesn't warn.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The "app opening" moment — a plain white screen with the (already
// brand-blue) W centered and fading in, then the whole thing fades to
// reveal the panel underneath (already rendering behind it the whole
// time, so nothing is delayed — this is a branded beat, not a loading
// wait). Shown once per browser tab/session, not on every visit while
// navigating around, so it reads as "opening the app" rather than
// repeating itself.
function PanelSplashIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, PANEL_SPLASH_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="wit-splash fixed inset-0 z-[100] flex items-center justify-center bg-white">
      <span className="wit-splash-mark">
        <WMark size={64} />
      </span>
    </div>,
    document.body,
  );
}

// Owns the splash overlay and nothing else, so its lifecycle is
// completely decoupled from whatever PanelContent is doing internally.
// PanelContent has several early returns (me.isLoading, not logged in,
// designer account, brandProfileQuery.isLoading, the real page) — each
// one is a different root element, so React unmounts/remounts whatever
// was rendered from the PREVIOUS branch every time the app moves between
// them. When the splash was rendered from inside each of those branches
// individually, a query resolving mid-splash (e.g. brandProfileQuery
// finishing while the 1.3s splash window was still running) unmounted
// that branch's <PanelSplashIntro/> instance and mounted a brand new one
// in the next branch — a fresh DOM node whose fade-in animation restarts
// from 0% opacity, which is exactly the brief flicker a client reported
// ("a veces parpadea, menos de un segundo"). Hoisting the splash here,
// one level up, means PanelContent can re-render and switch between
// branches however it needs to without ever touching this component or
// its portaled DOM node.
function Panel() {
  // The "app opening" intro (see PanelSplashIntro) — once per tab/session,
  // not replayed on every mount (e.g. navigating away to /upgrade and back
  // would otherwise remount Panel() and show it again, which reads as
  // repetitive rather than "opening the app"). Starts false on BOTH server
  // and client — reading sessionStorage inside the useState initializer
  // used to return true on the client's first (hydrating) render since
  // window exists there, but false during SSR (no window). That mismatch
  // between what the server sent and what the client immediately wanted to
  // paint is exactly the black-flash-white-flash-then-splash sequence: React
  // detects the hydration mismatch and throws away/redoes that render before
  // settling on the client's version. Deciding in an effect instead means
  // the very first paint is identical on both sides (no splash), and the
  // splash mounts a beat later, client-only, with nothing to reconcile.
  const [showSplash, setShowSplash] = useState(false);
  useIsomorphicLayoutEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem(PANEL_SPLASH_SESSION_KEY)) return;
    setShowSplash(true);
  }, []);
  function dismissSplash() {
    setShowSplash(false);
    sessionStorage.setItem(PANEL_SPLASH_SESSION_KEY, "1");
  }
  return (
    <>
      {showSplash ? <PanelSplashIntro onDone={dismissSplash} /> : null}
      <PanelContent />
    </>
  );
}

function PanelContent() {
  const me = useMe();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Top-level areas of the panel — Creatividad wraps everything that
  // existed before this section was introduced (solicitudes + hacer
  // solicitud); Activos de marca and Campañas are new.
  const [section, setSection] = useState<"creatividad" | "activos" | "campanas">("creatividad");
  // Within Creatividad: images, video and carousel are sibling request
  // types with the same "hacer solicitud / mis solicitudes" shape, picked
  // via the 3 accordion cards below — null means none of them is open yet,
  // which is also the initial state: nothing expands until a client taps
  // one, instead of "imagenes" opening itself on every visit.
  const [creativeMode, setCreativeMode] = useState<"imagenes" | "videos" | "carruseles" | null>(
    null,
  );
  // Opening a card now expands its panel right below the cards row, which on
  // mobile can land the "Hacer solicitud / Mis solicitudes" tabs behind the
  // fixed bottom nav — scroll them into view so they're never hidden there.
  const creativePanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (creativeMode) {
      creativePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [creativeMode]);
  // A separate top-level view, not a 4th SectionNav pill — account settings
  // aren't a "work area" like Creatividad/Activos/Campañas, they live behind
  // the avatar menu instead, same as most account dashboards.
  const [view, setView] = useState<"panel" | "perfil">("panel");
  // "Hacer solicitud" is the default landing tab for every visit, not just
  // a brand-new client's — creating a piece is the panel's main job, so it
  // should be the first thing anyone sees, not something they have to
  // switch to.
  const [tab, setTab] = useState<"solicitudes" | "nueva">("nueva");
  const [videoTab, setVideoTab] = useState<"solicitudes" | "nueva">("nueva");
  const [videoWizardOpen, setVideoWizardOpen] = useState(false);
  const [carouselTab, setCarouselTab] = useState<"solicitudes" | "nueva">("nueva");
  const [carouselWizardOpen, setCarouselWizardOpen] = useState(false);
  // The chat is a takeover of the content area, not a third tab — a totally
  // new client (no requests yet) lands straight on it; a returning one opens
  // it with the glowing "Chat IA" button and closes it (or taps a tab) to
  // get back to their solicitudes.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [justSent, setJustSent] = useState(false);
  // "Paquetes de imágenes" — a one-time top-up on solicitudes, available on
  // any active plan, stacking on top of the monthly quota with no
  // expiration. A modal (not a page) since it's a quick add-on purchase,
  // not a whole new flow like activating a membership.
  const [packsOpen, setPacksOpen] = useState(false);
  // Which locked quota ring (if any) the client just tapped — drives the
  // upgrade teaser popover. null = closed.
  const [upgradeTeaser, setUpgradeTeaser] = useState<"video" | "carrusel" | null>(null);
  // "Creatividades recientes" horizontal strip — scrolled with this ref
  // (arrow button + native touch swipe both use it) instead of paging
  // through state, since it's just a filmstrip, not a stepped carousel.
  const recentScrollRef = useRef<HTMLDivElement>(null);
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

  const videoRequests = useQuery({
    queryKey: ["video-requests"],
    queryFn: async () => {
      const res = await fetch("/api/video-requests", { credentials: "include" });
      if (!res.ok) return { ok: false, videoRequests: [] as VideoRequestRow[] };
      return (await res.json()) as { ok: boolean; videoRequests: VideoRequestRow[] };
    },
    enabled: Boolean(me.data?.ok),
    refetchInterval: 30_000,
  });

  const carouselRequests = useQuery({
    queryKey: ["carousel-requests"],
    queryFn: async () => {
      const res = await fetch("/api/carousel-requests", { credentials: "include" });
      if (!res.ok) return { ok: false, carouselRequests: [] as CarouselRequestRow[] };
      return (await res.json()) as { ok: boolean; carouselRequests: CarouselRequestRow[] };
    },
    enabled: Boolean(me.data?.ok),
    refetchInterval: 30_000,
  });

  // Same query the Campañas tab uses (CampanasPanel below) — sharing the
  // "campaigns" key means React Query dedupes the fetch when both are
  // mounted, and this one alone is enough to power the impact stats in the
  // header even when the client never opens that tab.
  const campaignsForImpact = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns", { credentials: "include" });
      if (!res.ok) return { ok: false, campaigns: [] as Campaign[] };
      return (await res.json()) as { ok: boolean; campaigns: Campaign[] };
    },
    enabled: Boolean(me.data?.ok),
  });

  // One membership, one business — once set (see /api/requests), company
  // name/colors/logo are locked here too, not just suggested.
  const brandProfileQuery = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      // Same reasoning as fetchMe() in witers-client.ts — an unbounded
      // fetch() can stall forever on a bad connection, leaving the panel
      // stuck on its loading skeleton with nothing the client can do about
      // it. Timing out turns that into a normal, recoverable failure.
      try {
        const res = await fetch("/api/brand-profile", {
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return { ok: false, profile: null as BrandProfile | null };
        return (await res.json()) as { ok: boolean; profile: BrandProfile | null };
      } catch {
        return { ok: false, profile: null as BrandProfile | null };
      }
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
          {t(
            "Ingresa a tu cuenta para ver tu panel de solicitudes.",
            "Log in to your account to see your requests panel.",
          )}
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Ingresar", "Log in")}
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
          {t(
            "Esta cuenta es de diseñador. Ve a tu panel de trabajo.",
            "This account is a designer account. Go to your work panel.",
          )}
        </p>
        <Link
          to="/witer"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Ir a mi panel", "Go to my panel")}
        </Link>
      </div>
    );
  }

  const membership = me.data.membership;
  const active = membership?.status === "active";
  const remaining = membership
    ? membership.requests_quota + membership.bonus_requests_quota - membership.requests_used
    : 0;
  const videoRemaining = membership
    ? membership.video_requests_quota - membership.video_requests_used
    : 0;
  const carouselRemaining = membership
    ? membership.carousel_requests_quota - membership.carousel_requests_used
    : 0;
  const rows = requests.data?.requests ?? [];
  const videoRows = videoRequests.data?.videoRequests ?? [];
  const carouselRows = carouselRequests.data?.carouselRequests ?? [];
  // "Impact panel" stats — closes the loop from pedir → pieza → campaña →
  // resultado, and doubles as the client's own history read back as an
  // achievement instead of a task list. All computed from data already
  // fetched for other tabs (requests, campaigns), nothing new to fetch.
  const streakWeeks = computeStreakWeeks(rows.map((r) => r.created_at));
  const impactCampaigns = campaignsForImpact.data?.campaigns ?? [];
  // "Lanzada" means it actually ran and reached someone — a campaign that
  // was created, never turned on, and later archived shouldn't count
  // toward this any more than a draft would. Real activity (impressions,
  // which implies spend/reach followed), not just existing as a row, is
  // what makes it count — a client caught exactly this: 3 archived,
  // never-activated campaigns were inflating the number.
  const activatedCampaigns = impactCampaigns.filter((c) => Number(c.impressions ?? 0) > 0);
  const campaignsLaunched = activatedCampaigns.length;
  const totalReach = activatedCampaigns.reduce((sum, c) => sum + Number(c.reach ?? 0), 0);
  // Results, not raw clicks — a click that never converts (never became a
  // WhatsApp chat, a lead, a sale...) isn't the win this badge is meant to
  // celebrate. See countResults in meta-ads.server.ts for what "counts."
  const totalResultsImpact = activatedCampaigns.reduce((sum, c) => sum + Number(c.results ?? 0), 0);

  // "Creatividades recientes" — imágenes and carruseles only, not video:
  // a delivered video has no stored still frame, and rendering a <video>
  // tag just to fake a thumbnail (or building real poster generation) is
  // more machinery than this strip is worth right now. Sorted by
  // created_at across both types (not per-type), same as the reference.
  const recentImageCreatives = rows
    .filter((r) => r.status === "completada" || r.status === "cerrada")
    .map((r) => {
      const latest = parseResults(r).at(-1);
      const thumbHref = latest
        ? (latest.image_url ?? `/api/file?key=${encodeURIComponent(latest.r2_key ?? "")}`)
        : null;
      return thumbHref
        ? { kind: "imagen" as const, id: r.id, title: r.title, thumbHref, createdAt: r.created_at }
        : null;
    })
    .filter((c) => c !== null);
  const recentCarouselCreatives = carouselRows
    .filter((r) => r.status === "completada")
    .map((r) => {
      const cover = parseSlides(r)[0]?.delivered_key;
      return cover
        ? {
            kind: "carrusel" as const,
            id: r.id,
            title: r.title,
            thumbHref: `/api/file?key=${encodeURIComponent(cover)}`,
            createdAt: r.created_at,
          }
        : null;
    })
    .filter((c) => c !== null);
  const RECENT_CREATIVES_MAX = 10;
  const recentCreatives = [...recentImageCreatives, ...recentCarouselCreatives]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, RECENT_CREATIVES_MAX);

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
  // Every brand's own palette, reused as the "atmosphere" wash behind the
  // Mi marca section (see BrandAtmosphere) — each client's panel should
  // actually feel like their brand, not a fixed WITERS color.
  const brandColorList = (brandProfile?.brand_colors ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  // Every member goes through the mandatory brand-onboarding chat exactly
  // once, before anything else in the panel — company name/colors/
  // category/logo get locked in right here instead of trickling in from
  // whatever a client happens to type on their first design request.
  // Gated on the fetch having actually succeeded (not just isFetched) so a
  // returning member with a real profile never gets funneled back into
  // onboarding just because that one fetch timed out or errored.
  const needsOnboarding = brandProfileQuery.data?.ok === true && !brandProfile;

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
      {section === "activos" ? (
        <BrandAtmosphere colors={brandColorList} key={brandProfile?.company_name ?? "none"} />
      ) : null}
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
            {t("Enviado", "Sent")}
          </div>
        </div>
      ) : null}
      <header className="wit-glass relative z-40 border-b border-wit-ink/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-5">
          <Link to="/" className="shrink-0">
            <WitersLogo compact />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageToggle />
            {/* Hidden on mobile — the bottom tab bar's avatar button covers
                this same job there (direct to Mi perfil, no dropdown). */}
            <div className="hidden sm:block">
              <UserMenu
                name={me.data.user?.name ?? ""}
                onOpenProfile={() => setView("perfil")}
                onLogout={logout}
              />
            </div>
          </div>
        </div>
      </header>

      <PanelBottomNav
        section={section}
        onSection={(s) => {
          setSection(s);
          setView("panel");
        }}
        view={view}
        onOpenChat={openChat}
        onOpenProfile={() => setView("perfil")}
        userInitial={(me.data.user?.name?.trim()[0] ?? "?").toUpperCase()}
      />

      <DesktopTopNav
        section={section}
        view={view}
        onSection={(s) => {
          setSection(s);
          setView("panel");
        }}
        onProfile={() => setView("perfil")}
      />

      <main className="mx-auto max-w-6xl px-5 py-10 pb-24 sm:pb-10">
        {view === "perfil" ? (
          <PerfilView me={me.data} onBack={() => setView("panel")} onLogout={logout} />
        ) : needsOnboarding ? (
          <OnboardingGate
            onDone={() => void qc.invalidateQueries({ queryKey: ["brand-profile"] })}
          />
        ) : (
          <>
            {/* Greeting, quota rings, campaign badges, membership CTA — all
                of it is "Inicio" content (the quick-glance overview a
                returning client wants first). Mi marca and Campañas now
                have their own top-of-section identity (BrandShowcaseCarousel
                / CampanasPanel's own header), so repeating this here just
                duplicated Inicio instead of feeling like a different place. */}
            {section === "creatividad" ? (
              <>
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
                        {t("Hola,", "Hi,")}{" "}
                        <span className="text-wit-blue">{me.data.user?.name?.split(" ")[0]}</span>
                      </h1>
                      {streakWeeks > 0 ? (
                        <span className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                          <Flame className="h-3.5 w-3.5" strokeWidth={2} />
                          {streakWeeks}{" "}
                          {t(
                            streakWeeks === 1 ? "semana seguida" : "semanas seguidas",
                            streakWeeks === 1 ? "week in a row" : "weeks in a row",
                          )}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base text-wit-gray">
                      {t(
                        "Pide creatividades y da seguimiento a cada solicitud desde aquí.",
                        "Request creatives and track every request from here.",
                      )}
                    </p>
                    <RecentCreativeQuickAccess
                      creative={recentCreatives[0]}
                      onOpen={(kind) => {
                        setSection("creatividad");
                        setCreativeMode(kind);
                        if (kind === "carruseles") setCarouselTab("solicitudes");
                        else setTab("solicitudes");
                      }}
                    />
                  </div>

                  <div className="flex flex-col items-stretch gap-2">
                    <div className="wit-glass flex flex-col gap-3 rounded-2xl px-5 py-4 shadow-[0_10px_30px_rgba(5,13,40,0.06)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-wit-gray">
                          {t("Tu cupo este mes", "Your quota this month")}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {active
                            ? t(
                                `${getPlan(membership?.plan).nombre} activa`,
                                `${getPlan(membership?.plan).nombre} active`,
                              )
                            : t("Sin membresía", "No membership")}
                        </span>
                      </div>
                      <div className="flex items-start justify-center gap-9">
                        <QuotaRing
                          icon={ImageIcon}
                          remaining={active ? remaining : 0}
                          quota={
                            (membership?.requests_quota ?? 20) +
                            (membership?.bonus_requests_quota ?? 0)
                          }
                          colorHex="#0047ff"
                          label={t("Imágenes", "Images")}
                        />
                        <QuotaRing
                          icon={VideoIcon}
                          remaining={active ? videoRemaining : 0}
                          quota={membership?.video_requests_quota ?? 0}
                          colorHex="#ff3fb0"
                          label={t("Video", "Video")}
                          locked={!membership || membership.video_requests_quota === 0}
                          onLockedClick={() => setUpgradeTeaser("video")}
                        />
                        <QuotaRing
                          icon={GalleryHorizontal}
                          remaining={active ? carouselRemaining : 0}
                          quota={membership?.carousel_requests_quota ?? 0}
                          colorHex="#10b981"
                          label={t("Carrusel", "Carousel")}
                          locked={!membership || membership.carousel_requests_quota === 0}
                          onLockedClick={() => setUpgradeTeaser("carrusel")}
                        />
                      </div>
                      {membership && membership.bonus_requests_quota > 0 ? (
                        <p className="text-center text-[11px] font-semibold text-wit-blue">
                          {t(
                            `+${membership.bonus_requests_quota} de paquetes comprados`,
                            `+${membership.bonus_requests_quota} from purchased packs`,
                          )}
                        </p>
                      ) : null}
                    </div>
                    {active && membership?.plan !== "scale" ? (
                      <Link
                        to="/upgrade"
                        className="flex items-center justify-center gap-1.5 rounded-full border border-wit-blue/30 bg-wit-blue/5 px-4 py-2 text-xs font-bold text-wit-blue transition-colors hover:bg-wit-blue/10"
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {t("Upgrade", "Upgrade")}
                      </Link>
                    ) : null}
                    {active ? (
                      <button
                        type="button"
                        onClick={() => setPacksOpen(true)}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-wit-blue/25 bg-white px-4 py-2 text-xs font-bold text-wit-blue transition-colors hover:bg-wit-blue/5"
                      >
                        <PackagePlus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {t("Comprar paquete de imágenes", "Buy an image pack")}
                      </button>
                    ) : null}
                  </div>
                </div>

                {campaignsLaunched > 0 || totalReach > 0 || totalResultsImpact > 0 ? (
                  // Their own history read back as an achievement, and the
                  // loop closed all the way to real results — not just a
                  // request counter. Each stat only shows once there's a real
                  // number to show; 0 campañas/0 alcance/0 clics would read as
                  // failure, not motivation. Fixed-size squares (not a
                  // stretching grid or plain rectangle) so they read as little
                  // badges, not wide bars — same size on every breakpoint.
                  // All three jump straight to Campañas when tapped — they're
                  // campaign stats, so "tell me more" should mean "show me the
                  // campaigns," not just sit there as a static number.
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {campaignsLaunched > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSection("campanas")}
                        className="flex aspect-square w-24 flex-col justify-center rounded-xl bg-wit-navy p-3 text-left text-white transition-transform active:scale-95"
                      >
                        <Rocket className="h-4 w-4 text-white/70" strokeWidth={1.75} />
                        <p className="mt-1.5 text-lg font-extrabold">{campaignsLaunched}</p>
                        <p className="text-[10px] leading-tight text-white/70">
                          {t(
                            campaignsLaunched === 1 ? "campaña lanzada" : "campañas lanzadas",
                            campaignsLaunched === 1 ? "campaign launched" : "campaigns launched",
                          )}
                        </p>
                      </button>
                    ) : null}
                    {totalReach > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSection("campanas")}
                        className="flex aspect-square w-24 flex-col justify-center rounded-xl bg-wit-blue p-3 text-left text-white transition-transform active:scale-95"
                      >
                        <Eye className="h-4 w-4 text-white/70" strokeWidth={1.75} />
                        <p className="mt-1.5 text-lg font-extrabold">
                          {totalReach.toLocaleString("es-MX")}
                        </p>
                        <p className="text-[10px] text-white/70">
                          {t("personas alcanzadas", "people reached")}
                        </p>
                      </button>
                    ) : null}
                    {totalResultsImpact > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSection("campanas")}
                        className="flex aspect-square w-24 flex-col justify-center rounded-xl bg-wit-pink p-3 text-left text-white transition-transform active:scale-95"
                      >
                        <Target className="h-4 w-4 text-white/70" strokeWidth={1.75} />
                        <p className="mt-1.5 text-lg font-extrabold">
                          {totalResultsImpact.toLocaleString("es-MX")}
                        </p>
                        <p className="text-[10px] text-white/70">
                          {t("resultados totales", "total results")}
                        </p>
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!active ? (
                  <div className="mt-8 flex flex-col items-start gap-4 rounded-3xl bg-wit-navy p-8 text-white md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xl font-bold">
                        {t(
                          "Activa tu membresía para empezar a crear.",
                          "Activate your membership to start creating.",
                        )}
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        {t(
                          "Elige entre Essential, Grow o Scale — desde $5,999 MXN al mes.",
                          "Choose Essential, Grow, or Scale — starting at $5,999 MXN a month.",
                        )}
                      </p>
                    </div>
                    <Link
                      to="/upgrade"
                      className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:brightness-110"
                    >
                      {t("Quiero mi membresía", "I want my membership")}
                    </Link>
                  </div>
                ) : null}
              </>
            ) : null}

            {section === "creatividad" ? (
              <>
                {/* Quick-start entry points, now also the only selector for
                    Imágenes/Videos/Carruseles — the old separate pill row
                    became redundant once tapping a card already switches
                    creativeMode, so it's gone. Always 3-across (no stacking
                    on mobile) since they're compact now. None is open by
                    default; tapping a card opens it (selects it AND jumps
                    to "Hacer solicitud"), tapping the already-open one
                    closes it back — true accordion, not just a switch
                    between three permanently-open states. The panel below
                    re-plays a rise-in (key={creativeMode}) so opening reads
                    as that card unfolding, not a random content swap. */}
                <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (creativeMode === "imagenes") {
                        setCreativeMode(null);
                        return;
                      }
                      setCreativeMode("imagenes");
                      setTab("nueva");
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 bg-white px-2 py-4 text-center transition-all active:scale-[0.98] sm:rounded-3xl ${
                      creativeMode === "imagenes"
                        ? "border-wit-blue shadow-[0_10px_30px_rgba(37,99,255,0.12)]"
                        : "border-transparent shadow-[0_10px_30px_rgba(5,13,40,0.06)] hover:-translate-y-0.5"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-wit-blue/10">
                      <ImageIcon className="h-5 w-5 text-wit-blue" strokeWidth={2} />
                    </span>
                    <span className="text-xs font-bold text-wit-ink sm:text-sm">
                      {t("Crear imagen", "Create image")}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        creativeMode === "imagenes"
                          ? "rotate-0 text-wit-blue"
                          : "-rotate-90 text-wit-gray"
                      }`}
                      strokeWidth={2.6}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (creativeMode === "videos") {
                        setCreativeMode(null);
                        return;
                      }
                      setCreativeMode("videos");
                      setVideoTab("nueva");
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 bg-white px-2 py-4 text-center transition-all active:scale-[0.98] sm:rounded-3xl ${
                      creativeMode === "videos"
                        ? "border-wit-pink shadow-[0_10px_30px_rgba(255,63,176,0.12)]"
                        : "border-transparent shadow-[0_10px_30px_rgba(5,13,40,0.06)] hover:-translate-y-0.5"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-wit-pink/10">
                      <VideoIcon className="h-5 w-5 text-wit-pink" strokeWidth={2} />
                    </span>
                    <span className="text-xs font-bold text-wit-ink sm:text-sm">
                      {t("Crear video", "Create video")}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        creativeMode === "videos"
                          ? "rotate-0 text-wit-pink"
                          : "-rotate-90 text-wit-gray"
                      }`}
                      strokeWidth={2.6}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (creativeMode === "carruseles") {
                        setCreativeMode(null);
                        return;
                      }
                      setCreativeMode("carruseles");
                      setCarouselTab("nueva");
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 bg-white px-2 py-4 text-center transition-all active:scale-[0.98] sm:rounded-3xl ${
                      creativeMode === "carruseles"
                        ? "border-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.12)]"
                        : "border-transparent shadow-[0_10px_30px_rgba(5,13,40,0.06)] hover:-translate-y-0.5"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
                      <GalleryHorizontal className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                    </span>
                    <span className="text-xs font-bold text-wit-ink sm:text-sm">
                      {t("Crear carrusel", "Create carousel")}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        creativeMode === "carruseles"
                          ? "rotate-0 text-emerald-600"
                          : "-rotate-90 text-wit-gray"
                      }`}
                      strokeWidth={2.6}
                    />
                  </button>
                </div>

                {creativeMode ? (
                  <div key={creativeMode} ref={creativePanelRef} className="wit-rise scroll-mt-24">
                    {creativeMode === "imagenes" ? (
                      <>
                        <div className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-wit-ink/10 pb-0">
                          <button
                            type="button"
                            onClick={() => setTab("nueva")}
                            className="-mb-px flex shrink-0 items-center gap-1.5 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
                          >
                            ✨ {t("Hacer solicitud", "Make a request")}
                          </button>
                          <PanelTab
                            active={tab === "solicitudes"}
                            onClick={() => setTab("solicitudes")}
                            label={t("Mis solicitudes", "My requests")}
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
                    ) : creativeMode === "videos" ? (
                      <>
                        <div className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-wit-ink/10 pb-0">
                          <button
                            type="button"
                            onClick={() => setVideoTab("nueva")}
                            className="-mb-px flex shrink-0 items-center gap-1.5 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
                          >
                            🎬 {t("Nueva solicitud", "New request")}
                          </button>
                          <PanelTab
                            active={videoTab === "solicitudes"}
                            onClick={() => setVideoTab("solicitudes")}
                            label={t("Mis solicitudes", "My requests")}
                            count={videoRows.length}
                          />
                        </div>

                        <div className="mt-8">
                          {videoTab === "nueva" ? (
                            <VideoLandingScreen
                              active={active}
                              quotaUsed={membership?.video_requests_used ?? 0}
                              quotaTotal={membership?.video_requests_quota ?? 0}
                              onStart={() => setVideoWizardOpen(true)}
                            />
                          ) : (
                            <VideoRequestList rows={videoRows} loading={videoRequests.isLoading} />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-wit-ink/10 pb-0">
                          <button
                            type="button"
                            onClick={() => setCarouselTab("nueva")}
                            className="-mb-px flex shrink-0 items-center gap-1.5 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
                          >
                            🖼️ {t("Nuevo carrusel", "New carousel")}
                          </button>
                          <PanelTab
                            active={carouselTab === "solicitudes"}
                            onClick={() => setCarouselTab("solicitudes")}
                            label={t("Mis solicitudes", "My requests")}
                            count={carouselRows.length}
                          />
                        </div>

                        <div className="mt-8">
                          {carouselTab === "nueva" ? (
                            <CarouselLandingScreen
                              active={active}
                              quotaUsed={membership?.carousel_requests_used ?? 0}
                              quotaTotal={membership?.carousel_requests_quota ?? 0}
                              onStart={() => setCarouselWizardOpen(true)}
                            />
                          ) : (
                            <CarouselRequestList
                              rows={carouselRows}
                              loading={carouselRequests.isLoading}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {recentCreatives.length > 0 ? (
                  <div className="mt-8">
                    <h2 className="text-lg font-bold text-wit-ink">
                      {t("Creatividades recientes", "Recent creatives")}
                    </h2>
                    <div className="relative mt-3">
                      <div
                        ref={recentScrollRef}
                        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {recentCreatives.map((c) => (
                          <div
                            key={c.id}
                            title={c.title}
                            className="aspect-square w-28 shrink-0 snap-start overflow-hidden rounded-2xl border border-wit-ink/10 bg-wit-mist/40 sm:w-36"
                          >
                            <img
                              src={c.thumbHref}
                              alt={c.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                      {recentCreatives.length > 3 ? (
                        <button
                          type="button"
                          onClick={() =>
                            recentScrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })
                          }
                          aria-label={t("Ver más creatividades", "See more creatives")}
                          className="absolute -right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-wit-ink/10 bg-white shadow-[0_10px_30px_rgba(5,13,40,0.15)]"
                        >
                          <ChevronRight className="h-4 w-4 text-wit-ink" strokeWidth={2.4} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : section === "activos" ? (
              <div className="mt-8">
                <BrandShowcaseCarousel brandProfile={brandProfile} />
                <div className="mt-10">
                  <ActivosDeMarca brandProfile={brandProfile} />
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <CampanasPanel companyName={brandProfile?.company_name ?? null} />
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
                disabledReason={
                  !active
                    ? t("Tu membresía no está activa todavía.", "Your membership isn't active yet.")
                    : remaining <= 0
                      ? t(
                          "Ya usaste todas tus solicitudes disponibles este mes.",
                          "You've already used all your available requests this month.",
                        )
                      : null
                }
                brandProfile={brandProfile}
                initialAnswers={chatKey === 0 ? (teaserAnswers ?? undefined) : undefined}
                recentRequestTitles={rows
                  .map((r) => r.title)
                  .filter((t): t is string => Boolean(t))
                  .slice(0, 5)}
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

      {packsOpen
        ? createPortal(
            <ImagePacksModal
              onClose={() => setPacksOpen(false)}
              onPurchased={() => {
                void qc.invalidateQueries({ queryKey: ["me"] });
                setPacksOpen(false);
              }}
            />,
            document.body,
          )
        : null}

      {upgradeTeaser
        ? (() => {
            const growPlan = getPlan("grow");
            const isVideo = upgradeTeaser === "video";
            const growQuota = isVideo
              ? growPlan.videoRequestsQuota
              : growPlan.carouselRequestsQuota;
            return createPortal(
              <UpgradeTeaser
                icon={isVideo ? VideoIcon : GalleryHorizontal}
                colorHex={isVideo ? "#ff3fb0" : "#10b981"}
                title={
                  isVideo
                    ? t("¿Quieres hacer videos?", "Want to make videos?")
                    : t("¿Quieres hacer carruseles?", "Want to make carousels?")
                }
                body={
                  isVideo
                    ? t(
                        `Con el plan ${growPlan.nombre} puedes crear hasta ${growQuota} videos al mes.`,
                        `With the ${growPlan.nombre} plan you can create up to ${growQuota} videos a month.`,
                      )
                    : t(
                        `Con el plan ${growPlan.nombre} puedes crear hasta ${growQuota} carruseles al mes.`,
                        `With the ${growPlan.nombre} plan you can create up to ${growQuota} carousels a month.`,
                      )
                }
                onClose={() => setUpgradeTeaser(null)}
              />,
              document.body,
            );
          })()
        : null}

      {videoWizardOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-white">
              <VideoWizard
                onClose={() => setVideoWizardOpen(false)}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["video-requests"] });
                  void qc.invalidateQueries({ queryKey: ["me"] });
                  setVideoWizardOpen(false);
                  setVideoTab("solicitudes");
                }}
              />
            </div>,
            document.body,
          )
        : null}

      {carouselWizardOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-white">
              <CarouselWizard
                disabledReason={
                  !active
                    ? t("Tu membresía no está activa todavía.", "Your membership isn't active yet.")
                    : (membership?.carousel_requests_quota ?? 0) -
                          (membership?.carousel_requests_used ?? 0) <=
                        0
                      ? t(
                          "Ya usaste todos tus carruseles disponibles este mes.",
                          "You've already used all your available carousels this month.",
                        )
                      : null
                }
                onClose={() => setCarouselWizardOpen(false)}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["carousel-requests"] });
                  void qc.invalidateQueries({ queryKey: ["me"] });
                  setCarouselWizardOpen(false);
                  setCarouselTab("solicitudes");
                }}
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
function buildOnboardingQuestions(
  t: (es: string, en: string) => string,
): { field: string; text: string; required: boolean }[] {
  return [
    {
      field: "companyName",
      text: t(
        "¿Cuál es el nombre de tu empresa o marca?",
        "What's the name of your company or brand?",
      ),
      required: true,
    },
    {
      field: "colors",
      text: t(
        "¿Tienes colores de marca que debamos usar? Si no tienes, elige los que más te gusten.",
        "Do you have brand colors we should use? If not, pick the ones you like best.",
      ),
      required: true,
    },
    {
      field: "businessType",
      text: t("¿En qué categoría cae tu negocio?", "What category does your business fall under?"),
      required: true,
    },
    { field: "logoKey", text: t("Sube tu logotipo.", "Upload your logo."), required: true },
  ];
}

// Mandatory, one-time chat that runs before anything else in the panel —
// collects the brand identity that /api/requests used to only infer from
// a client's very first design request. Resumable: every answer autosaves
// to brand_onboarding_drafts (see /api/onboarding/draft), so a client who
// closes the tab partway through picks up exactly where they left off.
function OnboardingGate({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const ONBOARDING_QUESTIONS = buildOnboardingQuestions(t);
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
  // Kept so a failed save can be retried with the exact same answers
  // instead of forcing the client to redo the whole conversation (which
  // for logoKey would mean re-uploading the file).
  const [lastAnswers, setLastAnswers] = useState<Record<string, string> | null>(null);
  // Bumped on a full restart to remount ChatIntakeFlow with a clean slate —
  // the component only resets its own internal state (answers, step) on
  // mount, there's no other way to force that from outside.
  const [resetKey, setResetKey] = useState(0);

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
    setLastAnswers(answers);
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
        setSendError(
          data.message ??
            t("Revisa tus respuestas e intenta de nuevo.", "Check your answers and try again."),
        );
        setSending(false);
        return;
      }
      onDone();
    } catch {
      setSendError(
        t(
          "No pudimos guardar los datos de tu marca. Intenta de nuevo.",
          "We couldn't save your brand data. Try again.",
        ),
      );
      setSending(false);
    }
  }

  // The nuclear option, for when retrying the same answers doesn't help
  // (e.g. the logo itself needs to be re-uploaded) — wipes the autosaved
  // draft and remounts the chat completely empty.
  async function restart() {
    setSendError(null);
    setSending(false);
    setLastAnswers(null);
    await fetch("/api/onboarding/draft", { method: "DELETE", credentials: "include" }).catch(
      () => null,
    );
    await qc.invalidateQueries({ queryKey: ["onboarding-draft"] });
    setResetKey((k) => k + 1);
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
        {t(
          "Antes de tu primera solicitud, cuéntanos de tu marca — solo te lo preguntamos una vez.",
          "Before your first request, tell us about your brand — we only ask this once.",
        )}
      </p>
      <ChatIntakeFlow
        key={resetKey}
        questions={ONBOARDING_QUESTIONS}
        pickerFor={pickerFor}
        initialAnswers={draftQuery.data?.answers}
        eyebrow={t("Conozcamos tu marca", "Let's get to know your brand")}
        onAnswer={(answers) => {
          void fetch("/api/onboarding/draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answers }),
          });
        }}
        onComplete={(answers) => void finish(answers)}
        pending={sending}
        pendingLabel={t("Guardando los datos de tu marca...", "Saving your brand data...")}
        doneLabel={
          sendError
            ? t("No pudimos guardar los datos de tu marca.", "We couldn't save your brand data.")
            : t("Los datos de tu marca han sido creados.", "Your brand data has been created.")
        }
        externalError={sendError}
        restart={() => void restart()}
        resultSlot={
          sendError ? (
            <button
              type="button"
              onClick={() => lastAnswers && void finish(lastAnswers)}
              className="-mt-2 ml-8 self-start rounded-full bg-wit-blue px-5 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
            >
              {t("Reintentar", "Retry")}
            </button>
          ) : null
        }
      />
    </div>
  );
}

// The interstitial that opens when the "✨ Hacer solicitud" tab is
// selected — a deliberate extra tap before the chat itself, so every
// client (not just brand-new ones) sees this moment instead of only
// stumbling into it once.
function HablaConWitScreen({ onStart }: { onStart: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-3xl bg-wit-ice py-20 text-center">
      <div className="wit-float">
        <WMark size={44} />
      </div>
      <p className="max-w-xs text-base text-wit-gray">
        {t(
          "Cuéntanos qué quieres crear hoy y armamos tu pieza juntos.",
          "Tell us what you want to create today and we'll build your piece together.",
        )}
      </p>
      <button
        type="button"
        onClick={onStart}
        className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
      >
        ✨ {t("Habla con Wit", "Talk to Wit")} ✨
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

// Small square thumbnail of the client's single most recent delivered
// creative, pinned right under the "Hola, X" greeting — a returning client
// with an existing piece used to land on a neutral picker with zero
// indication anything existed, having to first tap a "Crear X" card (which
// reads as "start something new") to even discover the "Mis solicitudes"
// tab hiding inside it. Tapping this jumps straight to that type's
// "Mis solicitudes" list. Nothing to show (no delivered piece yet, e.g. a
// brand-new client or one whose only request is still in progress) means
// this renders nothing — the create-cards further down are already that
// client's call to action.
function RecentCreativeQuickAccess({
  creative,
  onOpen,
}: {
  creative: { kind: "imagen" | "carrusel"; title: string; thumbHref: string } | undefined;
  onOpen: (kind: "imagenes" | "carruseles") => void;
}) {
  const { t } = useLanguage();
  if (!creative) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen(creative.kind === "carrusel" ? "carruseles" : "imagenes")}
      className="mt-4 flex items-center gap-3 self-start rounded-2xl transition-opacity hover:opacity-80"
    >
      <img
        src={creative.thumbHref}
        alt={creative.title}
        className="h-16 w-16 shrink-0 rounded-2xl border border-wit-ink/10 object-cover shadow-[0_10px_30px_rgba(5,13,40,0.08)]"
      />
      <span className="text-left">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
          {t("Mis solicitudes", "My requests")}
        </span>
        <span className="mt-0.5 block text-sm font-bold text-wit-blue">
          {t("Ver piezas ya hechas →", "See finished pieces →")}
        </span>
      </span>
    </button>
  );
}

// Avatar + dropdown in the header, replacing the old plain "Cerrar sesión"
// text link — account settings ("Mi perfil") live behind this, same as
// virtually every SaaS dashboard, instead of competing with Creatividad /
// Activos / Campañas as a 4th SectionNav pill.
function UserMenu({
  name,
  onOpenProfile,
  onLogout,
}: {
  name: string;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("Menú de cuenta", "Account menu")}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-wit-mist/50 sm:pr-3"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wit-blue text-sm font-bold text-white">
          {initial}
        </span>
        <span className="hidden text-sm font-medium text-wit-ink sm:block">{name}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`hidden text-wit-gray transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-wit-ink/10 bg-white py-1.5 shadow-[0_20px_50px_rgba(5,13,40,0.15)]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-wit-ink hover:bg-wit-mist/50"
          >
            <User size={16} strokeWidth={1.75} />
            {t("Mi perfil", "My profile")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} strokeWidth={1.75} />
            {t("Cerrar sesión", "Log out")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- MI PERFIL ---------------- */

function PerfilView({
  me,
  onBack,
  onLogout,
}: {
  me: Me;
  onBack: () => void;
  onLogout: () => void;
}) {
  const { t } = useLanguage();
  const plan = me.membership ? getPlan(me.membership.plan) : null;
  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-wit-gray hover:text-wit-ink"
      >
        <ArrowLeft size={16} strokeWidth={2.25} />
        {t("Volver al panel", "Back to panel")}
      </button>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tighter text-wit-ink">
        {t("Mi perfil", "My profile")}
      </h1>
      <p className="mt-1 text-sm text-wit-gray">
        {t(
          "Tus datos de cuenta, seguridad y membresía.",
          "Your account, security, and membership details.",
        )}
      </p>

      <div className="mt-8 space-y-6">
        <AccountCard user={me.user} />
        <PasswordCard />
        <MembershipSummaryCard membership={me.membership} plan={plan} />

        {me.user?.role === "admin" ? <StaffPanelLinksCard /> : null}

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700"
        >
          <LogOut size={16} strokeWidth={2.25} />
          {t("Cerrar sesión", "Log out")}
        </button>
      </div>
    </div>
  );
}

// Admin accounts aren't blocked from browsing the client panel (unlike
// designer accounts, which get redirected to /witer on sight — see the
// role === "designer" check above), so an admin who ends up here still
// needs a quick way back to the panels their role actually works in.
// Not shown for plain members — they have no other panel to go to.
function StaffPanelLinksCard() {
  const { t } = useLanguage();
  return (
    <div className="wit-glass rounded-2xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-wit-gray">
        {t("Otros accesos", "Other access")}
      </p>
      <div className="mt-3 space-y-2">
        <Link
          to="/admin"
          className="flex items-center justify-between rounded-xl border border-wit-ink/10 px-4 py-3 text-sm font-bold text-wit-ink transition-colors hover:bg-wit-mist/40"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-wit-blue" strokeWidth={2.2} />
            {t("Panel de administrador", "Admin panel")}
          </span>
          <ChevronRight className="h-4 w-4 text-wit-gray" />
        </Link>
        <Link
          to="/witer"
          className="flex items-center justify-between rounded-xl border border-wit-ink/10 px-4 py-3 text-sm font-bold text-wit-ink transition-colors hover:bg-wit-mist/40"
        >
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-wit-blue" strokeWidth={2.2} />
            {t("Panel de diseñador", "Designer panel")}
          </span>
          <ChevronRight className="h-4 w-4 text-wit-gray" />
        </Link>
      </div>
    </div>
  );
}

function AccountCard({ user }: { user: Me["user"] }) {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = name.trim() !== (user?.name ?? "").trim();

  async function save() {
    if (!dirty || name.trim().length < 2) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/update-name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        await qc.invalidateQueries({ queryKey: ["me"] });
        setMsg(t("Nombre actualizado.", "Name updated."));
      } else {
        setMsg(
          t(
            "No pudimos guardar el cambio. Intenta de nuevo.",
            "We couldn't save the change. Try again.",
          ),
        );
      }
    } catch {
      setMsg(
        t(
          "No pudimos guardar el cambio. Intenta de nuevo.",
          "We couldn't save the change. Try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at + "Z").toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <section className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">{t("Datos de la cuenta", "Account details")}</p>
      <p className="mt-1 text-sm text-wit-gray">
        {t(
          "Tu nombre, correo y antigüedad en WITERS.",
          "Your name, email, and time as a WITERS member.",
        )}
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="pname" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Nombre completo", "Full name")}
          </label>
          <input
            id="pname"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            className="w-full rounded-xl border border-wit-ink/15 bg-white px-4 py-3 text-base text-wit-ink outline-none transition-colors focus:border-wit-blue"
          />
        </div>
        <div>
          <p className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Correo electrónico", "Email address")}
          </p>
          <p className="rounded-xl border border-wit-ink/10 bg-wit-mist/30 px-4 py-3 text-base text-wit-gray">
            {user?.email}
          </p>
          <p className="mt-1.5 text-xs text-wit-gray">
            {t("¿Necesitas cambiarlo? Escríbenos a", "Need to change it? Email us at")}{" "}
            <a
              href="mailto:hola@witers.com"
              className="font-semibold text-wit-blue underline-offset-2 hover:underline"
            >
              hola@witers.com
            </a>
            .
          </p>
        </div>
        {memberSince ? (
          <p className="text-xs text-wit-gray">
            {t(`Miembro desde el ${memberSince}.`, `Member since ${memberSince}.`)}
          </p>
        ) : null}
      </div>

      {msg ? <p className="mt-4 text-sm text-wit-gray">{msg}</p> : null}

      <button
        type="button"
        disabled={!dirty || saving || name.trim().length < 2}
        onClick={save}
        className="mt-5 rounded-2xl bg-wit-blue px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? t("Guardando...", "Saving...") : t("Guardar cambios", "Save changes")}
      </button>
    </section>
  );
}

function PasswordCard() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setError(
          data.error === "contrasena_actual_incorrecta"
            ? t("Tu contraseña actual no es correcta.", "Your current password is incorrect.")
            : t(
                "No pudimos cambiar tu contraseña. Intenta de nuevo.",
                "We couldn't change your password. Try again.",
              ),
        );
      }
    } catch {
      setError(
        t(
          "No pudimos cambiar tu contraseña. Intenta de nuevo.",
          "We couldn't change your password. Try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">{t("Seguridad", "Security")}</p>
      <p className="mt-1 text-sm text-wit-gray">
        {t("Cambia tu contraseña cuando quieras.", "Change your password whenever you want.")}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="pw-current" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Contraseña actual", "Current password")}
          </label>
          <PasswordInput
            id="pw-current"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pw-new" className="mb-1.5 block text-sm font-semibold text-wit-ink">
              {t("Nueva contraseña", "New password")}
            </label>
            <PasswordInput
              id="pw-new"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={t("Mínimo 8 caracteres", "At least 8 characters")}
            />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-1.5 block text-sm font-semibold text-wit-ink">
              {t("Confirmar nueva contraseña", "Confirm new password")}
            </label>
            <PasswordInput
              id="pw-confirm"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && next !== confirm ? (
              <p className="mt-1 text-xs text-red-600">
                {t("Las contraseñas no coinciden.", "Passwords don't match.")}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t("Contraseña actualizada.", "Password updated.")}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="rounded-2xl bg-wit-blue px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t("Guardando...", "Saving...") : t("Cambiar contraseña", "Change password")}
        </button>
      </form>
    </section>
  );
}

function MembershipSummaryCard({
  membership,
  plan,
}: {
  membership: Me["membership"];
  plan: ReturnType<typeof getPlan> | null;
}) {
  const active = membership?.status === "active";
  const { t } = useLanguage();
  const activatedLabel = membership?.activated_at
    ? new Date(membership.activated_at + "Z").toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const qc = useQueryClient();
  const [packsOpen, setPacksOpen] = useState(false);

  return (
    <section className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">{t("Tu membresía", "Your membership")}</p>
      <p className="mt-1 text-sm text-wit-gray">
        {t("Resumen de tu plan actual.", "Summary of your current plan.")}
      </p>

      {!membership || !plan ? (
        <div className="mt-5 rounded-2xl border border-dashed border-wit-ink/15 p-5 text-center">
          <p className="text-sm text-wit-gray">
            {t(
              "Todavía no tienes una membresía activa.",
              "You don't have an active membership yet.",
            )}
          </p>
          <Link
            to="/checkout"
            className="mt-3 inline-block rounded-full bg-wit-blue px-5 py-2.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
          >
            {t("Activar membresía", "Activate membership")}
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-wit-navy p-5 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                {t("Tu plan", "Your plan")}
              </p>
              <p className="mt-1 text-2xl font-extrabold">WITERS {plan.nombre}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                active ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {active ? t("Activa", "Active") : membership.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
                {t("Solicitudes usadas", "Requests used")}
              </p>
              <p className="mt-0.5 font-wit-mono text-lg font-semibold text-wit-ink">
                {membership.requests_used}/
                {membership.requests_quota + membership.bonus_requests_quota}
              </p>
              {membership.bonus_requests_quota > 0 ? (
                <p className="mt-0.5 text-[11px] font-semibold text-wit-blue">
                  {t(
                    `+${membership.bonus_requests_quota} de paquetes`,
                    `+${membership.bonus_requests_quota} from packs`,
                  )}
                </p>
              ) : null}
            </div>
            {membership.video_requests_quota > 0 ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
                  {t("Videos usados", "Videos used")}
                </p>
                <p className="mt-0.5 font-wit-mono text-lg font-semibold text-wit-ink">
                  {membership.video_requests_used}/{membership.video_requests_quota}
                </p>
              </div>
            ) : null}
            {activatedLabel ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
                  {t("Activa desde", "Active since")}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-wit-ink">{activatedLabel}</p>
              </div>
            ) : null}
          </div>

          {active && membership.plan !== "scale" ? (
            <Link
              to="/upgrade"
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-wit-blue/30 bg-wit-blue/5 px-4 py-2.5 text-xs font-bold text-wit-blue transition-colors hover:bg-wit-blue/10"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t("Upgrade", "Upgrade")}
            </Link>
          ) : null}

          {active ? (
            <button
              type="button"
              onClick={() => setPacksOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-wit-blue/25 px-4 py-2.5 text-xs font-bold text-wit-blue transition-colors hover:bg-wit-blue/5"
            >
              <PackagePlus className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t("Comprar paquete de imágenes", "Buy an image pack")}
            </button>
          ) : null}

          <p className="text-xs text-wit-gray">
            <Link
              to="/terminos"
              className="font-semibold text-wit-blue underline-offset-2 hover:underline"
            >
              {t("Ver términos y condiciones", "View terms and conditions")}
            </Link>
          </p>
        </div>
      )}

      {packsOpen
        ? createPortal(
            <ImagePacksModal
              onClose={() => setPacksOpen(false)}
              onPurchased={() => {
                void qc.invalidateQueries({ queryKey: ["me"] });
                setPacksOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

// One-time "paquetes de imágenes" purchase — a modal, not a page, since it's
// a quick add-on on top of an already-active membership (see
// /api/purchase-pack). Reuses the same sandbox card-form pattern as
// /checkout: card fields accepted for UX completeness, payment always
// "succeeds" until a real gateway is connected.
function ImagePacksModal({
  onClose,
  onPurchased,
}: {
  onClose: () => void;
  onPurchased: () => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<(typeof IMAGE_PACKS)[number] | null>(null);
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    const digits = card.number.replace(/\s+/g, "");
    if (digits.length < 15 || digits.length > 16) {
      setError(t("Revisa el número de tarjeta.", "Check the card number."));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/purchase-pack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cardName: card.name,
          cardLast4: digits.slice(-4),
          packId: selected.id,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError(
          t(
            "No pudimos procesar el pago. Intenta de nuevo.",
            "We couldn't process the payment. Try again.",
          ),
        );
        return;
      }
      onPurchased();
    } catch {
      setError(
        t(
          "No pudimos procesar el pago. Intenta de nuevo.",
          "We couldn't process the payment. Try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-wit-ink/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-7 shadow-[0_30px_80px_rgba(5,13,40,0.25)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-wit-ink">
              {t("Paquetes de imágenes", "Image packs")}
            </p>
            <p className="mt-1 text-sm text-wit-gray">
              {t(
                "Solicitudes extra sin subir de plan. No expiran.",
                "Extra requests without upgrading your plan. They never expire.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-wit-gray hover:bg-wit-mist/50 hover:text-wit-ink"
            aria-label={t("Cerrar", "Close")}
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>

        {!selected ? (
          <div className="mt-6 space-y-3">
            {IMAGE_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelected(pack)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-wit-ink/10 p-4 text-left transition-colors hover:border-wit-blue hover:bg-wit-blue/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wit-blue/10 text-wit-blue">
                    <Images className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-wit-ink">
                      {t(`${pack.images} imágenes`, `${pack.images} images`)}
                    </p>
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {t("30% de descuento", "30% off")}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-wit-mono text-base font-bold text-wit-ink">
                    {fmt(pack.precioPromo)}
                  </p>
                  <p className="font-wit-mono text-[11px] text-wit-gray line-through">
                    {fmt(pack.precioRegular)}
                  </p>
                </div>
              </button>
            ))}
            <p className="pt-1 text-center text-[11px] leading-relaxed text-wit-gray">
              {t(
                "Precios en MXN + IVA. Se suman a tu saldo mensual y se quedan disponibles hasta que los uses.",
                "Prices in MXN + VAT. They're added to your monthly balance and stay available until you use them.",
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={pay} className="mt-6">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-xs font-semibold text-wit-gray hover:text-wit-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
              {t("Elegir otro paquete", "Choose a different pack")}
            </button>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-wit-navy p-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                  {t(`${selected.images} imágenes`, `${selected.images} images`)}
                </p>
                <p className="mt-1 font-wit-mono text-xl font-semibold">
                  {fmt(selected.precioPromo)}{" "}
                  <span className="text-xs font-semibold text-white/60 line-through">
                    {fmt(selected.precioRegular)}
                  </span>
                </p>
              </div>
              <Plus className="h-5 w-5 shrink-0 text-white/40" strokeWidth={2} />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="pkname" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                  {t("Nombre en la tarjeta", "Name on card")}
                </label>
                <input
                  id="pkname"
                  type="text"
                  required
                  minLength={2}
                  value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                  className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
                  placeholder={t("Como aparece en la tarjeta", "As it appears on the card")}
                />
              </div>
              <div>
                <label htmlFor="pknum" className="mb-1.5 block text-sm font-semibold text-wit-ink">
                  {t("Número de tarjeta", "Card number")}
                </label>
                <input
                  id="pknum"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  required
                  value={card.number}
                  onChange={(e) =>
                    setCard({
                      ...card,
                      number: e.target.value
                        .replace(/[^\d]/g, "")
                        .replace(/(\d{4})(?=\d)/g, "$1 ")
                        .slice(0, 19),
                    })
                  }
                  className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 font-wit-mono text-sm outline-none focus:border-wit-blue"
                  placeholder="4242 4242 4242 4242"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="pkexp"
                    className="mb-1.5 block text-sm font-semibold text-wit-ink"
                  >
                    {t("Vencimiento", "Expiry")}
                  </label>
                  <input
                    id="pkexp"
                    type="text"
                    required
                    value={card.exp}
                    onChange={(e) =>
                      setCard({
                        ...card,
                        exp: e.target.value
                          .replace(/[^\d]/g, "")
                          .replace(/(\d{2})(?=\d)/, "$1/")
                          .slice(0, 5),
                      })
                    }
                    className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 font-wit-mono text-sm outline-none focus:border-wit-blue"
                    placeholder={t("MM/AA", "MM/YY")}
                  />
                </div>
                <div>
                  <label
                    htmlFor="pkcvc"
                    className="mb-1.5 block text-sm font-semibold text-wit-ink"
                  >
                    CVC
                  </label>
                  <input
                    id="pkcvc"
                    type="password"
                    required
                    value={card.cvc}
                    onChange={(e) =>
                      setCard({ ...card, cvc: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })
                    }
                    className="w-full rounded-xl border border-wit-ink/15 px-4 py-2.5 font-wit-mono text-sm outline-none focus:border-wit-blue"
                    placeholder="123"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-2xl bg-wit-blue px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:opacity-60"
            >
              {loading
                ? t("Procesando pago...", "Processing payment...")
                : t(
                    `Pagar ${fmt(selected.precioPromo)} MXN`,
                    `Pay ${fmt(selected.precioPromo)} MXN`,
                  )}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-wit-gray">
              {t(
                "Entorno de pago en modo de activación directa. La pasarela definitiva (Stripe o Mercado Pago) se conecta sin cambiar este flujo.",
                "Payment environment in direct-activation mode. The final gateway (Stripe or Mercado Pago) connects without changing this flow.",
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// The panel's primary navigation, desktop-only — the same 4 destinations
// PanelBottomNav gives mobile (Inicio/Mi marca/Campañas/Perfil), just
// styled as a segmented pill row and moved above the greeting instead of
// docked to the bottom of the screen, since a wide viewport has no
// thumb-reach reason to keep it fixed at the bottom. Mobile is untouched
// — this sits in `sm:` and up only, PanelBottomNav still owns everything
// below that breakpoint.
function DesktopTopNav({
  section,
  view,
  onSection,
  onProfile,
}: {
  section: "creatividad" | "activos" | "campanas";
  view: "panel" | "perfil";
  onSection: (section: "creatividad" | "activos" | "campanas") => void;
  onProfile: () => void;
}) {
  const { t } = useLanguage();
  const items: { active: boolean; onClick: () => void; es: string; en: string }[] = [
    {
      active: view === "panel" && section === "creatividad",
      onClick: () => onSection("creatividad"),
      es: "Inicio",
      en: "Home",
    },
    {
      active: view === "panel" && section === "activos",
      onClick: () => onSection("activos"),
      es: "Mi marca",
      en: "My brand",
    },
    {
      active: view === "panel" && section === "campanas",
      onClick: () => onSection("campanas"),
      es: "Campañas",
      en: "Campaigns",
    },
    { active: view === "perfil", onClick: onProfile, es: "Perfil", en: "Profile" },
  ];
  return (
    <div className="hidden sm:block">
      <div className="mx-auto max-w-6xl px-5 pt-6">
        <div className="wit-glass inline-flex gap-1 rounded-2xl p-1 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
          {items.map((it) => (
            <button
              key={it.es}
              type="button"
              onClick={it.onClick}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                it.active
                  ? "bg-wit-blue text-white"
                  : "text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
              }`}
            >
              {t(it.es, it.en)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mobile-only bottom tab bar. Home/Biblioteca/Campañas mirror SectionNav's
// three areas (hidden here, this replaces it on small screens); Perfil
// mirrors the header avatar (also hidden on mobile — see UserMenu). The
// center button is new: Wit as an always-on presence, not just a button
// you notice when its idle text says "chat with us" — same drifting
// gradient as "Hablar con Wit", but the halo breathes continuously so it
// reads as alive at rest, and the W mark bobs like the mascot mark used
// elsewhere (.wit-float).
function PanelBottomNav({
  section,
  onSection,
  view,
  onOpenChat,
  onOpenProfile,
  userInitial,
}: {
  section: "creatividad" | "activos" | "campanas";
  onSection: (section: "creatividad" | "activos" | "campanas") => void;
  view: "panel" | "perfil";
  onOpenChat: () => void;
  onOpenProfile: () => void;
  userInitial: string;
}) {
  const { t } = useLanguage();

  // Icon + label share one pill: active gets a soft wit-blue highlight
  // behind the icon (the "selected" look from the Instagram reference),
  // inactive stays bare on the white glass.
  function NavTab({
    active,
    onClick,
    icon,
    label,
  }: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
            active ? "bg-wit-blue/10" : ""
          }`}
        >
          {icon}
        </span>
        <span className={`text-[10px] font-semibold ${active ? "text-wit-blue" : "text-wit-gray"}`}>
          {label}
        </span>
      </button>
    );
  }

  const homeActive = view === "panel" && section === "creatividad";
  const activosActive = view === "panel" && section === "activos";
  const campanasActive = view === "panel" && section === "campanas";
  const perfilActive = view === "perfil";

  return (
    <nav
      className="fixed inset-x-4 z-40 sm:hidden"
      style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
    >
      {/* Two glass pills with a gap between them, not one solid bar — the
        orb floats centered in that gap, level with the icons, without
        either pill's glass ever touching it. */}
      <div className="mx-auto flex max-w-6xl items-center gap-1.5">
        <div className="wit-glass flex flex-1 items-center rounded-full px-1">
          <NavTab
            active={homeActive}
            onClick={() => onSection("creatividad")}
            icon={
              <Home
                size={18}
                strokeWidth={2}
                className={homeActive ? "text-wit-blue" : "text-wit-gray"}
              />
            }
            label={t("Inicio", "Home")}
          />
          <NavTab
            active={activosActive}
            onClick={() => onSection("activos")}
            icon={
              <BookOpen
                size={18}
                strokeWidth={2}
                className={activosActive ? "text-wit-blue" : "text-wit-gray"}
              />
            }
            label={t("Mi marca", "My brand")}
          />
        </div>

        <button
          type="button"
          onClick={onOpenChat}
          aria-label={t("Hablar con Wit", "Talk to Wit")}
          className="wit-orb flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full active:scale-95"
        >
          {/* overflow-hidden on the button above is a hard guarantee the
            mark can never visually escape the circle, however far the
            float animation drifts. WMark is a solid wit-blue PNG — invert
            it to white so it reads against the orb's gradient. */}
          <span
            className="wit-float-soft flex items-center justify-center"
            style={{ filter: "brightness(0) invert(1)" }}
          >
            <WMark size={22} />
          </span>
        </button>

        <div className="wit-glass flex flex-1 items-center rounded-full px-1">
          <NavTab
            active={campanasActive}
            onClick={() => onSection("campanas")}
            icon={
              <Megaphone
                size={18}
                strokeWidth={2}
                className={campanasActive ? "text-wit-blue" : "text-wit-gray"}
              />
            }
            label={t("Campañas", "Campaigns")}
          />
          <NavTab
            active={perfilActive}
            onClick={onOpenProfile}
            icon={
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                  perfilActive ? "bg-wit-blue text-white" : "bg-wit-mist text-wit-gray"
                }`}
              >
                {userInitial}
              </span>
            }
            label={t("Perfil", "Profile")}
          />
        </div>
      </div>
    </nav>
  );
}

const CAMPAIGN_ICON = (
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
);

const CAMPAIGN_STATUS_LABEL: Record<string, { es: string; en: string; cls: string }> = {
  ACTIVE: { es: "Activa", en: "Active", cls: "bg-emerald-50 text-emerald-700" },
  PAUSED: { es: "Pausada", en: "Paused", cls: "bg-amber-50 text-amber-700" },
  DELETED: { es: "Eliminada", en: "Deleted", cls: "bg-red-50 text-red-600" },
  ARCHIVED: { es: "Archivada", en: "Archived", cls: "bg-wit-mist/60 text-wit-gray" },
};

type Campaign = {
  id: string;
  name: string | null;
  dailyBudgetCents: number | null;
  createdAt: string;
  metaStatus: string;
  spend: string | null;
  impressions: string | null;
  clicks: string | null;
  reach: string | null;
  results: string | null;
  costPerResult: string | null;
  previewImageUrls: string[];
  insightError: string | null;
};

// Always laid out in one scrollable horizontal row (see the 5-stat rows
// below) rather than a wrapping grid — min-w keeps a stat from getting
// squeezed unreadably narrow on a small screen instead of just wrapping.
function CampaignStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[74px] shrink-0 rounded-xl bg-wit-ice/60 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase leading-tight tracking-wide text-wit-gray">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold text-wit-ink">{value}</p>
    </div>
  );
}

// The per-ad drill-down behind a campaign card. Lives in its own file,
// lazy-loaded below (see CampaignAdDetailModal's dynamic import) — it pulls
// in react-day-picker + date-fns for the date-range picker inside it, which
// added ~430KB to this route's bundle when they were imported here directly
// for a modal most visits never open.
const CampaignAdDetailModal = lazy(() => import("../components/witers/campaign-ad-detail-modal"));
// Same react-day-picker/date-fns weight as the modal above, now reused at
// the top of the Campañas tab itself — lazy for the same reason.
const CampaignDateRangePicker = lazy(
  () => import("../components/witers/campaign-date-range-picker"),
);

// Real campaign list now — refreshes every time this mounts, and every 60s
// while it's open, matching the "se actualiza sola, no empujado al
// instante" explanation given for how Meta itself reports ad performance.
// Every ad's creative shows here, small and complete (not one blown up to
// a banner) — a campaign can run several different pieces at once, and a
// single large image both looked blurry (Meta's own thumbnails aren't shot
// for that size) and hid the rest of what's actually running.
function CampaignCard({ c, onOpenDetail }: { c: Campaign; onOpenDetail: () => void }) {
  const { t } = useLanguage();
  const st = CAMPAIGN_STATUS_LABEL[c.metaStatus] ?? {
    es: c.metaStatus,
    en: c.metaStatus,
    cls: "bg-wit-mist/60 text-wit-gray",
  };
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="wit-glass block w-full rounded-2xl p-6 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)] transition-colors hover:border-wit-blue/40"
    >
      {c.previewImageUrls.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {c.previewImageUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl border border-wit-ink/10 object-cover sm:h-20 sm:w-20"
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-wit-ink">{c.name ?? t("Campaña", "Campaign")}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
          {t(st.es, st.en)}
        </span>
      </div>
      {c.dailyBudgetCents != null ? (
        <p className="mt-1.5 text-xs text-wit-gray">
          {t(
            `Presupuesto: $${(c.dailyBudgetCents / 100).toLocaleString("es-MX")} MXN/día`,
            `Budget: $${(c.dailyBudgetCents / 100).toLocaleString("es-MX")} MXN/day`,
          )}
        </p>
      ) : null}
      {c.insightError ? (
        <p className="mt-3 text-xs text-red-600">
          {t(
            `No pudimos leer sus métricas: ${c.insightError}`,
            `We couldn't read its metrics: ${c.insightError}`,
          )}
        </p>
      ) : (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <CampaignStat
            label={t("Gastado", "Spent")}
            value={`$${Number(c.spend ?? 0).toLocaleString("es-MX")}`}
          />
          <CampaignStat
            label={t("Alcance", "Reach")}
            value={Number(c.reach ?? 0).toLocaleString("es-MX")}
          />
          <CampaignStat
            label={t("Resultados", "Results")}
            value={Number(c.results ?? 0).toLocaleString("es-MX")}
          />
          <CampaignStat
            label={t("Costo/res.", "Cost/result")}
            value={`$${Number(c.costPerResult ?? 0).toLocaleString("es-MX")}`}
          />
        </div>
      )}
      <p className="mt-4 text-xs font-semibold text-wit-blue">
        {t("Ver detalle por anuncio →", "See per-ad detail →")}
      </p>
    </button>
  );
}

const ES_MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Formats an ISO date as "1 ago" — matches the per-campaign modal's
// date-fns "d MMM" (Spanish locale) output, but hand-rolled here so
// CampanasPanel (part of panel.tsx's main bundle, not lazy like the modal)
// doesn't need to statically import date-fns just to render a label.
function formatEsShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${ES_MONTH_SHORT[d.getMonth()]}`;
}

// Real campaign list now — refreshes every time this mounts, and every 60s
// while it's open, matching the "se actualiza sola, no empujado al
// instante" explanation given for how Meta itself reports ad performance.
function CampanasPanel({ companyName }: { companyName: string | null }) {
  const { t } = useLanguage();
  const [showArchived, setShowArchived] = useState(false);
  const [openCampaign, setOpenCampaign] = useState<Campaign | null>(null);
  // null = "todo el tiempo" — same date-range filter as the per-campaign
  // detail modal, now scoped to the whole Campañas tab: the list's own
  // stats and the "todas las campañas" report below both read from this.
  const [range, setRange] = useState<CampaignRange | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const campaigns = useQuery({
    queryKey: ["campaigns", range?.since ?? null, range?.until ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range) {
        params.set("since", range.since);
        params.set("until", range.until);
      }
      const qs = params.toString();
      const res = await fetch(`/api/campaigns${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) return { ok: false, campaigns: [] as Campaign[] };
      return (await res.json()) as { ok: boolean; campaigns: Campaign[] };
    },
    refetchInterval: 60_000,
  });
  const rows = campaigns.data?.campaigns ?? [];
  // Meta never really deletes a campaign either — "eliminar" in Ads
  // Manager just flips its status to ARCHIVED/DELETED, same data kept for
  // reporting. Mirroring that here: nothing gets dropped from our own
  // history, but a campaign someone cleaned up in Ads Manager shouldn't
  // sit with the same visual weight as one that's actually live.
  const liveRows = rows.filter((c) => c.metaStatus !== "ARCHIVED" && c.metaStatus !== "DELETED");
  const archivedRows = rows.filter(
    (c) => c.metaStatus === "ARCHIVED" || c.metaStatus === "DELETED",
  );
  const rangeLabel = range
    ? `${formatEsShortDate(range.since)} – ${formatEsShortDate(range.until)}`
    : t("Todo el tiempo", "All time");

  // "Hacer reporte" for the whole tab, not one campaign — a summary row per
  // campaign plus each campaign's own ad breakdown, all for the currently
  // selected range. The summary numbers come straight from `rows` (already
  // range-filtered by the query above); the per-campaign ad tables need
  // their own fetch each, same endpoint the per-campaign modal uses.
  async function handleGlobalReport() {
    if (generatingReport || rows.length === 0) return;
    setGeneratingReport(true);
    try {
      const summaries: ReportCampaignSummary[] = rows.map((c) => ({
        name: c.name,
        status: c.metaStatus,
        spend: c.spend ?? "0",
        impressions: c.impressions ?? "0",
        reach: c.reach ?? "0",
        results: c.results ?? "0",
        costPerResult: c.costPerResult ?? "0",
      }));
      const sections: ReportCampaignSection[] = await Promise.all(
        rows.map(async (c) => {
          const params = new URLSearchParams({ id: c.id });
          if (range) {
            params.set("since", range.since);
            params.set("until", range.until);
          }
          const res = await fetch(`/api/campaign-ads?${params.toString()}`, {
            credentials: "include",
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok: boolean;
            ads?: ReportAd[];
          };
          return { name: c.name, ads: data.ok ? (data.ads ?? []) : [] };
        }),
      );
      const bytes = await buildAllCampaignsReportPdf({
        companyName,
        rangeLabel,
        campaigns: summaries,
        sections,
      });
      downloadPdf(bytes, "WITERS-Reporte-campanas.pdf");
    } finally {
      setGeneratingReport(false);
    }
  }

  if (campaigns.isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  if (liveRows.length === 0 && archivedRows.length === 0) {
    return (
      <div className="wit-glass flex flex-col items-center gap-4 rounded-3xl px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wit-blue/10 text-wit-blue">
          {CAMPAIGN_ICON}
        </span>
        <p className="text-lg font-bold text-wit-ink">
          {t("Aún no tienes campañas", "You don't have any campaigns yet")}
        </p>
        <p className="max-w-sm text-sm text-wit-gray">
          {t(
            "Contáctanos para pautar tu primera campaña en Meta — nosotros la configuramos y aquí verás sus resultados en vivo.",
            "Contact us to launch your first campaign on Meta — we set it up and you'll see its live results here.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-full bg-white/70" />}>
          <CampaignDateRangePicker range={range} onChange={setRange} />
        </Suspense>
        <button
          type="button"
          onClick={handleGlobalReport}
          disabled={generatingReport || rows.length === 0}
          className="flex items-center gap-1.5 rounded-full bg-wit-blue px-3.5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {generatingReport ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
          ) : (
            <FileDown className="h-3.5 w-3.5" strokeWidth={2.2} />
          )}
          {t("Hacer reporte", "Generate report")}
        </button>
      </div>
      {liveRows.length === 0 ? (
        <div className="wit-glass flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wit-blue/10 text-wit-blue">
            {CAMPAIGN_ICON}
          </span>
          <p className="text-lg font-bold text-wit-ink">
            {t("No tienes campañas activas", "You don't have any active campaigns")}
          </p>
          <p className="max-w-sm text-sm text-wit-gray">
            {t(
              "Tus campañas anteriores quedaron archivadas — puedes verlas abajo.",
              "Your previous campaigns were archived — you can see them below.",
            )}
          </p>
        </div>
      ) : (
        liveRows.map((c) => (
          <CampaignCard key={c.id} c={c} onOpenDetail={() => setOpenCampaign(c)} />
        ))
      )}
      {archivedRows.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-wit-ink/10 bg-white px-5 py-3 text-sm font-semibold text-wit-gray hover:border-wit-blue/40 hover:text-wit-blue"
          >
            {t(`Archivadas (${archivedRows.length})`, `Archived (${archivedRows.length})`)}
            <span className="text-xs">
              {showArchived ? t("Ocultar ▲", "Hide ▲") : t("Ver ▼", "View ▼")}
            </span>
          </button>
          {showArchived ? (
            <div className="mt-4 space-y-4">
              {archivedRows.map((c) => (
                <CampaignCard key={c.id} c={c} onOpenDetail={() => setOpenCampaign(c)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {openCampaign
        ? createPortal(
            <Suspense
              fallback={
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-wit-ink/50 p-4 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-white" strokeWidth={2.5} />
                </div>
              }
            >
              <CampaignAdDetailModal
                campaign={openCampaign}
                companyName={companyName}
                onClose={() => setOpenCampaign(null)}
              />
            </Suspense>,
            document.body,
          )
        : null}
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
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const key = await uploadReferenceFile(file);
      if (!key) {
        setError(
          t(
            `No pudimos subir el archivo (${acceptHint}).`,
            `We couldn't upload the file (${acceptHint}).`,
          ),
        );
        return;
      }
      const res = await fetch(uploadEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setError(
          t(
            "No pudimos guardar el archivo. Intenta de nuevo.",
            "We couldn't save the file. Try again.",
          ),
        );
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
            <p className="truncate text-sm font-semibold text-wit-ink">
              {t("Archivo guardado", "File saved")}
            </p>
            <a
              href={`/api/file?key=${encodeURIComponent(fileKey)}&download=1`}
              className="text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
            >
              {t("Descargar", "Download")}
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-wit-ink/15 p-4 text-center text-sm text-wit-gray">
          {t(
            `Aún no tienes ${title.toLowerCase()} guardado.`,
            `You don't have a saved ${title.toLowerCase()} yet.`,
          )}
        </p>
      )}

      <label className="mt-4 block">
        <span className="sr-only">
          {fileKey
            ? t(`Reemplazar ${title.toLowerCase()}`, `Replace ${title.toLowerCase()}`)
            : t(`Subir ${title.toLowerCase()}`, `Upload ${title.toLowerCase()}`)}
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
      {uploading ? (
        <p className="mt-2 text-xs font-semibold text-wit-blue">
          {t("Subiendo...", "Uploading...")}
        </p>
      ) : null}
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
  const { t } = useLanguage();
  const [requested, setRequested] = useState(false);

  return (
    <div className="wit-glass rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <p className="text-lg font-bold text-wit-ink">{t("Logotipo", "Logo")}</p>
      <p className="mt-1 text-sm text-wit-gray">
        {t(
          "El logotipo que usamos en cada pieza que creamos para ti.",
          "The logo we use on every piece we create for you.",
        )}
      </p>

      {fileKey ? (
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-wit-ink/10 p-4">
          <img
            src={`/api/file?key=${encodeURIComponent(fileKey)}`}
            alt={t("Logotipo", "Logo")}
            className="h-16 w-16 shrink-0 rounded-xl border border-wit-ink/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-wit-ink">
              {t("Archivo guardado", "File saved")}
            </p>
            <a
              href={`/api/file?key=${encodeURIComponent(fileKey)}&download=1`}
              className="text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
            >
              {t("Descargar", "Download")}
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-wit-ink/15 p-4 text-center text-sm text-wit-gray">
          {t("Aún no tienes logotipo guardado.", "You don't have a saved logo yet.")}
        </p>
      )}

      <button
        type="button"
        onClick={() => setRequested(true)}
        className="mt-4 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
      >
        {t("Solicitar cambio de logotipo", "Request a logo change")}
      </button>
      {requested ? (
        <p className="mt-3 rounded-xl bg-wit-ice px-3.5 py-2.5 text-xs text-wit-ink">
          {t(
            "Muy pronto vas a poder platicar esto directo con soporte desde aquí. Mientras tanto, escríbenos a",
            "Soon you'll be able to talk to support about this right here. In the meantime, email us at",
          )}{" "}
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
  const { t } = useLanguage();
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
        setError(
          t(
            "No pudimos guardar tus colores. Intenta de nuevo.",
            "We couldn't save your colors. Try again.",
          ),
        );
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
      <p className="text-lg font-bold text-wit-ink">{t("Colores de marca", "Brand colors")}</p>
      <p className="mt-1 text-sm text-wit-gray">
        {t(
          "Los colores que usamos en cada pieza que creamos para ti.",
          "The colors we use on every piece we create for you.",
        )}
      </p>

      {editing ? (
        <div className="mt-5">
          <ColorsPicker onPick={(v) => void save(v)} />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mx-auto mt-3 block text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            {t("Cancelar", "Cancel")}
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
          {t("Aún no tienes colores de marca guardados.", "You don't have saved brand colors yet.")}
        </p>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {colorList.length
            ? t("Editar colores", "Edit colors")
            : t("Elegir colores", "Choose colors")}
        </button>
      ) : null}
      {saving ? (
        <p className="mt-2 text-xs font-semibold text-wit-blue">{t("Guardando...", "Saving...")}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

// Near-white brand colors (plenty of brands have one) would otherwise
// pick as an atmosphere blob and render as an invisible smear against
// the page's already-light background — most visibly right behind the
// header, which is exactly the "stark white bar" seam a client would
// notice. Filtering those out keeps every blob actually visible.
function isNearWhite(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.88;
}

// The Mi marca section's "atmosphere" — a soft, slow-drifting wash built
// from the client's own brand colors, so each brand's panel actually
// feels like their brand instead of a fixed WITERS color. Blurred blobs
// sit behind everything (cards stay white/opaque on top, so legibility
// never depends on what colors a client happens to have picked); falls
// back to a neutral WITERS-blue duo when no colors are set yet.
function BrandAtmosphere({ colors }: { colors: string[] }) {
  const usable = colors.filter((c) => !isNearWhite(c));
  const palette = usable.length ? usable : ["#0047FF", "#6B8CFF"];
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 animate-in fade-in overflow-hidden duration-700">
      <span
        className="wit-atmosphere-blob wit-atmosphere-blob-a"
        style={{ background: palette[0] }}
      />
      <span
        className="wit-atmosphere-blob wit-atmosphere-blob-b"
        style={{ background: palette[1 % palette.length] }}
      />
      {palette.length > 2 ? (
        <span
          className="wit-atmosphere-blob wit-atmosphere-blob-c"
          style={{ background: palette[2] }}
        />
      ) : null}
    </div>
  );
}

// A visual-only "wow, this is my brand" showcase — swipeable cards you
// glance at, not edit. The actual upload/edit controls stay in the plain
// list below (ActivosDeMarca) unchanged; cramming forms into a
// swipeable card felt clumsy on mobile, so this stays a pure preview.
function BrandShowcaseCarousel({ brandProfile }: { brandProfile: BrandProfile | null }) {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  const colors = (brandProfile?.brand_colors ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const cards: { id: string; content: ReactNode }[] = [
    {
      id: "identidad",
      content: (
        <BrandShowcaseIdentityCard
          companyName={brandProfile?.company_name ?? t("Tu marca", "Your brand")}
          businessType={brandProfile?.business_type ?? null}
          colors={colors}
        />
      ),
    },
    { id: "logo", content: <BrandShowcaseLogoCard fileKey={brandProfile?.logo_key ?? null} /> },
    { id: "colores", content: <BrandShowcaseColorsCard colors={colors} /> },
    {
      id: "manual",
      content: <BrandShowcaseManualCard hasManual={Boolean(brandProfile?.brand_manual_key)} />,
    },
  ];

  // The Instagram-stories "cube" feeling — each card tilts in 3D around
  // the edge it shares with its neighbor as it approaches/leaves center,
  // instead of just sliding flat. Riding on native scroll-snap (not a
  // hand-rolled drag/touch implementation) for the actual swipe physics —
  // this only recomputes each card's rotation from its live scroll
  // position, rAF-throttled so it stays cheap during the scroll gesture.
  function updateTilt() {
    const el = trackRef.current;
    if (!el) return;
    const centerX = el.scrollLeft + el.clientWidth / 2;
    cardRefs.current.forEach((card) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const raw = (cardCenter - centerX) / card.offsetWidth;
      const offset = Math.max(-1.3, Math.min(1.3, raw));
      const rotation = offset * -38;
      const scale = 1 - Math.min(Math.abs(offset), 1) * 0.1;
      card.style.transformOrigin = offset >= 0 ? "left center" : "right center";
      card.style.transform = `rotateY(${rotation}deg) scale(${scale})`;
      card.style.opacity = String(1 - Math.min(Math.abs(offset), 1) * 0.4);
    });
  }

  function handleScroll() {
    const el = trackRef.current;
    const first = el?.firstElementChild;
    if (el && first instanceof HTMLElement) {
      const cardWidth = first.offsetWidth + 16;
      setActive(Math.round(el.scrollLeft / cardWidth));
    }
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      updateTilt();
      rafRef.current = null;
    });
  }

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    updateTilt();
    window.addEventListener("resize", updateTilt);
    return () => window.removeEventListener("resize", updateTilt);
  }, []);

  return (
    <div>
      {/* Mobile/narrow: the swipeable cube-tilt carousel — one card
          centered at a time, which is exactly the layout the tilt math
          assumes. On a wide viewport several cards are visible at once,
          and rotating the off-center ones made them visually overlap/fan
          out instead of reading as a cube — so desktop gets a plain
          static grid instead (below), no scroll or tilt needed once
          there's enough room to just show all four side by side. */}
      <div className="md:hidden">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          style={{ perspective: "1400px" }}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((card, i) => (
            <div
              key={card.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={{ backfaceVisibility: "hidden" }}
              className="w-[96%] shrink-0 snap-center sm:w-[30rem]"
            >
              {card.content}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          {cards.map((card, i) => (
            <span
              key={card.id}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-wit-blue" : "w-1.5 bg-wit-ink/15"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.id}>{card.content}</div>
        ))}
      </div>
    </div>
  );
}

function BrandShowcaseIdentityCard({
  companyName,
  businessType,
  colors,
}: {
  companyName: string;
  businessType: string | null;
  colors: string[];
}) {
  const { t } = useLanguage();
  const c1 = colors[0] ?? "#0047FF";
  const c2 = colors[colors.length - 1] ?? "#6B8CFF";
  // Layered soft-edged radials, sitting BEHIND a wit-glass pane rather than
  // painted straight on the card — the frost is what turns it into a
  // diffused wash instead of a flat colored block, and matches the same
  // liquid-glass look as every other card here (and the header above).
  // `isolate` keeps the wash contained to this card: wit-glass itself has
  // no z-index, so a negative one on a child would otherwise escape past
  // it looking for the next real stacking context up the tree.
  const wash = `radial-gradient(120% 140% at 8% -10%, ${c1} 0%, transparent 62%), radial-gradient(130% 150% at 100% 115%, ${c2} 0%, transparent 62%)`;
  return (
    <div className="relative isolate flex aspect-[4/3] overflow-hidden rounded-3xl shadow-[0_20px_60px_rgba(5,13,40,0.12)]">
      <div className="absolute inset-0" style={{ background: wash }} />
      <div className="wit-glass absolute inset-0 rounded-3xl" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-wit-gray">
          {t("Tu marca", "Your brand")}
        </span>
        <div>
          {businessType ? (
            <span className="mb-2 inline-block rounded-full bg-wit-ink/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-wit-ink">
              {businessType}
            </span>
          ) : null}
          <p className="text-2xl font-extrabold leading-tight text-wit-ink">{companyName}</p>
        </div>
      </div>
    </div>
  );
}

function BrandShowcaseLogoCard({ fileKey }: { fileKey: string | null }) {
  const { t } = useLanguage();
  return (
    <div className="wit-glass flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl p-6">
      {fileKey ? (
        <img
          src={`/api/file?key=${encodeURIComponent(fileKey)}`}
          alt={t("Logotipo", "Logo")}
          className="max-h-28 max-w-full object-contain"
        />
      ) : (
        <p className="text-center text-sm text-wit-gray">
          {t("Aún no tienes logotipo guardado.", "You don't have a saved logo yet.")}
        </p>
      )}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-wit-gray">
        {t("Logotipo", "Logo")}
      </p>
    </div>
  );
}

function BrandShowcaseColorsCard({ colors }: { colors: string[] }) {
  const { t } = useLanguage();
  return (
    <div className="wit-glass flex aspect-[4/3] flex-col justify-between rounded-3xl p-5">
      {colors.length ? (
        <div className="grid flex-1 grid-cols-2 gap-2.5">
          {colors.slice(0, 4).map((c) => (
            <div
              key={c}
              className="flex flex-col justify-end rounded-2xl p-2.5"
              style={{ background: c }}
            >
              <span className="rounded-full bg-black/25 px-2 py-0.5 text-center text-[10px] font-bold uppercase text-white backdrop-blur-sm">
                {c}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-wit-gray">
            {t("Aún no tienes colores guardados.", "You don't have saved colors yet.")}
          </p>
        </div>
      )}
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-wit-gray">
        {t("Colores de marca", "Brand colors")}
      </p>
    </div>
  );
}

function BrandShowcaseManualCard({ hasManual }: { hasManual: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="wit-glass flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wit-blue/10 text-wit-blue">
        <FileText className="h-6 w-6" strokeWidth={2} />
      </span>
      <p className="text-center text-sm text-wit-gray">
        {hasManual
          ? t("Tu manual de marca está guardado.", "Your brand manual is saved.")
          : t("Aún no tienes manual de marca.", "You don't have a brand manual yet.")}
      </p>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-wit-gray">
        {t("Manual de marca", "Brand manual")}
      </p>
    </div>
  );
}

function ActivosDeMarca({ brandProfile }: { brandProfile: BrandProfile | null }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["brand-profile"] });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <BrandColorsCard brandProfile={brandProfile} />
      <LogoCard fileKey={brandProfile?.logo_key ?? null} />
      <BrandAssetCard
        title={t("Manual de marca", "Brand manual")}
        description={t(
          "Tus lineamientos de marca — colores, tipografías, uso del logo.",
          "Your brand guidelines — colors, fonts, logo usage.",
        )}
        fileKey={brandProfile?.brand_manual_key ?? null}
        isPdf={true}
        onUploaded={refresh}
        uploadEndpoint="/api/brand-profile-manual"
        accept="application/pdf"
        acceptHint={t("PDF, máx. 15 MB", "PDF, max. 15 MB")}
      />
    </div>
  );
}

/* ---------- Wit conversation (request creation) ---------- */

// Stand-in for a missing/empty title from the model's final answer —
// short enough to read as a title, not a re-statement of the whole brief.
// not a re-statement of the whole brief.
function deriveTitle(
  pieceBrief: string | undefined,
  companyName: string | undefined,
  lang: "es" | "en" = "es",
): string {
  const brief = (pieceBrief ?? "").trim();
  if (!brief) {
    return lang === "en"
      ? `Piece for ${companyName ?? "your brand"}`
      : `Pieza para ${companyName ?? "tu marca"}`;
  }
  return brief.length > 60 ? `${brief.slice(0, 57).trimEnd()}...` : brief;
}

// The confirm/review box that appears in place of ChatIntakeFlow's
// AI-generated-fields box once every question is answered — same
// long-press-to-edit transcript stays live above it, so there's one way to
// correct an answer (not a second "editar" flow bolted onto this box).
function ChatReviewBox({
  answers,
  disabledReason,
  sendError,
  sending,
  onConfirm,
}: {
  answers: Record<string, string>;
  // Why the submit button can't be used right now (no active membership,
  // no quota left) — shown right above it instead of just quietly greying
  // it out, which left a fully-filled-out request with no explanation for
  // why "Confirmar y enviar" wouldn't respond to a tap.
  disabledReason: string | null;
  sendError: string | null;
  sending: boolean;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const disabled = Boolean(disabledReason);
  const colorList = (answers.colors ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const aspectRatioLabel = RATIO_LABEL[answers.aspectRatio ?? ""];
  return (
    <div className="wit-glass w-full rounded-2xl p-5 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <dl className="space-y-3.5">
        <PreviewRow label={t("Título", "Title")} value={answers.title ?? ""} />
        <PreviewRow
          label={t("Nombre comercial / empresa", "Business / company name")}
          value={answers.companyName ?? ""}
        />
        <PreviewRow
          label={t("Qué quieres que salga en esta pieza", "What you want in this piece")}
          value={answers.pieceBrief ?? ""}
        />
        {answers.audience ? (
          <PreviewRow label={t("Público objetivo", "Target audience")} value={answers.audience} />
        ) : null}
        {answers.ageRanges ? (
          <PreviewRow label={t("Rango de edad", "Age range")} value={answers.ageRanges} />
        ) : null}
        {answers.promoPrice ? (
          <PreviewRow
            label={t("Precio o descuento", "Price or discount")}
            value={answers.promoPrice}
          />
        ) : null}
        {answers.requiredText ? (
          <PreviewRow
            label={t("Mensaje o dato extra", "Message or extra detail")}
            value={answers.requiredText}
          />
        ) : null}
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
            {t("Colores de marca", "Brand colors")}
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
        {answers.style ? <PreviewRow label={t("Estilo", "Style")} value={answers.style} /> : null}
        <PreviewRow
          label={t("Formato", "Format")}
          value={
            aspectRatioLabel
              ? t(aspectRatioLabel.es, aspectRatioLabel.en)
              : (answers.aspectRatio ?? t("Cuadrado", "Square"))
          }
        />
        {answers.logoKey && answers.logoKey !== "Sin logotipo" ? (
          <PreviewImageRow label={t("Logotipo", "Logo")} fileKey={answers.logoKey} />
        ) : (
          <PreviewRow label={t("Logotipo", "Logo")} value={t("No tiene logotipo", "No logo")} />
        )}
        {answers.productPhotoKeys
          ? answers.productPhotoKeys
              .split(",")
              .filter(Boolean)
              .map((key, i, all) => (
                <PreviewImageRow
                  key={key}
                  label={
                    all.length > 1
                      ? t(`Foto de referencia ${i + 1}`, `Reference photo ${i + 1}`)
                      : t("Foto de referencia", "Reference photo")
                  }
                  fileKey={key}
                />
              ))
          : null}
      </dl>

      {sendError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{sendError}</p>
      ) : null}
      {disabledReason ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {disabledReason}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || sending}
        className="mt-5 w-full rounded-2xl bg-wit-blue px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? t("Enviando...", "Sending...") : t("Confirmar y enviar", "Confirm and send")}
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

const ASPECT_RATIO_PROMPT = {
  es: "¿Qué forma te imaginas para tu pieza?",
  en: "What shape do you picture for your piece?",
};

// Anything handed off from the homepage teaser (see teaser-handoff.ts), plus
// a short list of this client's past pieces, becomes a hidden context
// message — sent to the model on every turn, never rendered as a bubble —
// so Wit can lean on it (e.g. to propose several concrete directions after
// the client's first reply) without ever asking the client to repeat it.
// See the system prompt in wit-chat.server.ts for what it does with this.
function buildContextPrimer(
  initialAnswers?: Record<string, string>,
  recentTitles?: string[],
): string {
  const bits: string[] = [];
  if (initialAnswers) {
    const teaserBits = Object.entries(initialAnswers)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `${k}: ${v}`);
    if (teaserBits.length) {
      bits.push(
        `Esto es lo que el cliente ya compartió en la página principal antes de registrarse: ${teaserBits.join("; ")}.`,
      );
    }
  }
  if (recentTitles?.length) {
    bits.push(
      `Piezas que este cliente ya pidió antes (más reciente primero): ${recentTitles.join(", ")}.`,
    );
  }
  if (!bits.length) {
    bits.push(
      "Este cliente no ha compartido nada todavía ni tiene solicitudes previas — es su primera pieza.",
    );
  }
  return bits.join(" ");
}

// Replaces the old scripted question list with a real, live back-and-forth
// with ChatGPT (via /api/wit/chat) — the model decides what to ask, infers
// the rest with its own creative/persuasive judgment, and only interrupts
// the free-form chat once, to hand off to the existing visual
// AspectRatioPicker for the format question. Company name/colors/category/
// logo never come up — those are already locked in brandProfile by the
// mandatory onboarding chat (see OnboardingGate) by the time this ever runs.
function WitConversation({
  disabledReason,
  onCreated,
  onClose,
  brandProfile,
  initialAnswers,
  recentRequestTitles,
}: {
  disabledReason: string | null;
  onCreated: () => void;
  onClose: () => void;
  brandProfile: BrandProfile | null;
  initialAnswers?: Record<string, string>;
  recentRequestTitles?: string[];
}) {
  const { t, lang } = useLanguage();
  const [contextPrimer] = useState(() => buildContextPrimer(initialAnswers, recentRequestTitles));
  const [messages, setMessages] = useState<WitMessage[]>([
    {
      role: "assistant",
      content: t(
        "¡Hola! Cuéntame, ¿qué pieza quieres crear hoy?",
        "Hi! Tell me, what piece do you want to create today?",
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [awaitingAspectRatio, setAwaitingAspectRatio] = useState(false);
  const [pieceFields, setPieceFields] = useState<WitPieceFields | null>(null);
  // Every reference photo the client attaches, in the order added — used to
  // be a single string that silently got overwritten by the next upload, so
  // only the last photo ever reached the designer even if the client
  // attached several. Now accumulates, with each one shown as a thumbnail
  // (below) and removable individually.
  const [productPhotoKeys, setProductPhotoKeys] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // The client's own pick from AspectRatioPicker, trusted directly for the
  // final request — never re-derived from the model's echo of it in
  // submit_piece_details.
  const [pickedAspectRatio, setPickedAspectRatio] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, awaitingAspectRatio, pieceFields]);

  // Grows the box downward as the client types/dictates, so everything
  // stays visible instead of scrolling out of view inside a fixed box —
  // capped so a very long message still gets its own internal scroll
  // instead of swallowing the screen. Growing it alone isn't enough
  // though: nothing else scrolls to follow it, so the client had to drag
  // the screen down by hand to see what they'd just typed. scrollIntoView
  // brings it back into view as it grows, same as the message list itself
  // already does when a new bubble arrives.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [input]);

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
        setChatError(
          t(
            "Wit no está disponible en este momento. Intenta de nuevo en un momento.",
            "Wit is not available right now. Try again in a moment.",
          ),
        );
        return;
      }
      if (data.kind === "message") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else if (data.kind === "ask_aspect_ratio") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t(ASPECT_RATIO_PROMPT.es, ASPECT_RATIO_PROMPT.en),
            widget: "aspectRatio",
          },
        ]);
        setAwaitingAspectRatio(true);
      } else {
        setPieceFields(data.fields);
      }
    } catch {
      setChatError(
        t(
          "No pudimos hablar con Wit. Revisa tu conexión e intenta de nuevo.",
          "We could not reach Wit. Check your connection and try again.",
        ),
      );
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

  // "A veces las personas se equivocan" — undoes the client's last message
  // and whatever Wit replied to it, so a wrong answer (or an accidental
  // aspect-ratio pick) can be corrected without restarting the whole
  // conversation. Only ever rewinds one exchange at a time, not a full
  // history — that's enough for "I made a mistake just now" without the
  // complexity of a real multi-step undo stack.
  function undoLast() {
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1 || typing) return;
    const next = messages.slice(0, lastUserIdx);
    const newLast = next[next.length - 1];
    // If undoing the pick lands back on the format question, reopen the
    // picker instead of leaving the client stuck with no way to answer it.
    const backToAspectRatio = newLast?.role === "assistant" && newLast.widget === "aspectRatio";
    setMessages(next);
    setAwaitingAspectRatio(backToAspectRatio);
    if (backToAspectRatio) setPickedAspectRatio(null);
    setPieceFields(null);
    setChatError(null);
  }

  async function addProductPhotos(files: FileList) {
    setUploadingPhotos(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const key = await uploadReferenceFile(file);
        if (key) uploaded.push(key);
      }
      if (uploaded.length > 0) {
        setProductPhotoKeys((prev) => [...prev, ...uploaded]);
        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            content:
              uploaded.length > 1
                ? t(
                    `Adjunté ${uploaded.length} fotos de referencia del producto.`,
                    `I attached ${uploaded.length} reference photos of the product.`,
                  )
                : t(
                    "Adjunté una foto de referencia del producto.",
                    "I attached a reference photo of the product.",
                  ),
          },
        ]);
      }
      if (uploaded.length < files.length) {
        setChatError(
          t(
            "Algunas fotos no se pudieron subir (PNG, JPG o WebP, máx. 8 MB cada una).",
            "Some photos couldn't be uploaded (PNG, JPG or WebP, max 8 MB each).",
          ),
        );
      }
    } finally {
      setUploadingPhotos(false);
    }
  }

  function removeProductPhoto(key: string) {
    setProductPhotoKeys((prev) => prev.filter((k) => k !== key));
  }

  // The one moment this hands off to a real picker instead of free text —
  // the client's choice both drives the visible transcript (so the model
  // sees exactly what was picked, in its own words) and is trusted
  // directly for the final request (see pickedAspectRatio above), never
  // re-derived from the model's own echo of it in submit_piece_details.
  function pickAspectRatio(value: string) {
    setAwaitingAspectRatio(false);
    setPickedAspectRatio(value);
    const ratioLabel = RATIO_LABEL[value];
    const label = ratioLabel ? t(ratioLabel.es, ratioLabel.en) : value;
    const next: WitMessage[] = [
      ...messages,
      { role: "user", content: t(`Elijo el formato: ${label}.`, `I choose the format: ${label}.`) },
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
            pieceFields.title ||
            deriveTitle(pieceFields.pieceBrief, brandProfile?.company_name, lang),
          companyName: brandProfile?.company_name,
          pieceBrief: pieceFields.pieceBrief,
          style: pieceFields.style || undefined,
          businessType: brandProfile?.business_type || undefined,
          aspectRatio: pickedAspectRatio ?? pieceFields.aspectRatio ?? "1:1",
          logoKey: noLogo ? undefined : (brandProfile?.logo_key ?? undefined),
          noLogo,
          productPhotoKeys: productPhotoKeys.length ? productPhotoKeys : undefined,
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
            ? t(
                "Ya usaste todas tus solicitudes disponibles.",
                "You have already used all your available requests.",
              )
            : data.error === "sin_membresia"
              ? t(
                  "Necesitas una membresía activa para enviar solicitudes.",
                  "You need an active membership to send requests.",
                )
              : (data.message ??
                t(
                  "Revisa tus respuestas e intenta de nuevo.",
                  "Check your answers and try again.",
                )),
        );
        return;
      }
      onCreated();
    } catch {
      setSendError(
        t(
          "No pudimos enviar tu solicitud. Intenta de nuevo.",
          "We could not send your request. Try again.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  const reviewAnswers: Record<string, string> | null = pieceFields
    ? {
        title:
          pieceFields.title ||
          deriveTitle(pieceFields.pieceBrief, brandProfile?.company_name, lang),
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
        // Joined, not an array — reviewAnswers is a flat Record<string,
        // string> shared with the rest of the review card; R2 keys never
        // contain commas, so split(",") on the render side is safe.
        productPhotoKeys: productPhotoKeys.join(","),
      }
    : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden px-5 pb-4 pt-4">
      <div className="relative flex flex-col items-center gap-1.5 pb-1 pt-1">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Cerrar chat", "Close chat")}
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
          >
            ×
          </button>
        ) : null}
        <div className="wit-float">
          <WMark size={26} />
        </div>
        <p className="text-sm font-medium text-wit-ink">
          {t("Hablando con Wit", "Talking with Wit")}
        </p>
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
              <ChatBubble
                role="assistant"
                text={t(
                  "¡Listo! Revisa tu solicitud antes de enviarla:",
                  "Done! Review your request before sending it:",
                )}
              />
              {reviewAnswers ? (
                <ChatReviewBox
                  answers={reviewAnswers}
                  disabledReason={disabledReason}
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
          {awaitingAspectRatio ? null : (
            <>
              {productPhotoKeys.length > 0 ? (
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                  {productPhotoKeys.map((key) => (
                    <div key={key} className="relative shrink-0">
                      <img
                        src={`/api/file?key=${encodeURIComponent(key)}`}
                        alt=""
                        className="h-14 w-14 rounded-xl border border-wit-ink/10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeProductPhoto(key)}
                        aria-label={t("Quitar foto", "Remove photo")}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wit-navy text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(5,13,40,0.3)] hover:bg-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendText(input);
                }}
                className="wit-glass flex items-end gap-2 rounded-3xl p-1.5 pl-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
              >
                <textarea
                  ref={composerRef}
                  rows={1}
                  maxLength={2000}
                  aria-label={t("Tu mensaje", "Your message")}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText(input);
                    }
                  }}
                  disabled={typing}
                  placeholder={t("Escribe tu mensaje...", "Type your message...")}
                  // text-base (16px), not text-sm — iOS Safari auto-zooms
                  // the ENTIRE page on focus for any input under 16px, which
                  // is what was actually forcing a manual pinch-to-zoom-out
                  // afterward, not the box's own size.
                  className="max-h-[160px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-2.5 text-base text-wit-ink outline-none placeholder:text-wit-gray disabled:opacity-50"
                />
                <MicButton value={input} onChange={setInput} />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  aria-label={t("Enviar mensaje", "Send message")}
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

              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void addProductPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="mt-2 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={uploadingPhotos}
                  onClick={() => photoInputRef.current?.click()}
                  className="text-center text-xs font-semibold text-wit-gray hover:text-wit-ink disabled:opacity-60"
                >
                  {uploadingPhotos
                    ? t("Subiendo...", "Uploading...")
                    : `📎 ${t("Adjuntar fotos de referencia", "Attach reference photos")}`}
                </button>
                {messages.some((m) => m.role === "user") ? (
                  <button
                    type="button"
                    disabled={typing}
                    onClick={undoLast}
                    className="text-center text-xs font-semibold text-wit-gray hover:text-wit-ink disabled:opacity-60"
                  >
                    {`↩ ${t("Deshacer", "Undo")}`}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- new request form ---------- */

const STYLE_CHIPS = [
  { value: "Minimalista", labelEs: "Minimalista", labelEn: "Minimalist" },
  { value: "Premium / Elegante", labelEs: "Premium / Elegante", labelEn: "Premium / Elegant" },
  { value: "Colorido", labelEs: "Colorido", labelEn: "Colorful" },
  { value: "Corporativo", labelEs: "Corporativo", labelEn: "Corporate" },
  { value: "Divertido / Bold", labelEs: "Divertido / Bold", labelEn: "Fun / Bold" },
];
const AGE_CHIPS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const RATIO_LABEL: Record<string, { es: string; en: string }> = {
  "1:1": { es: "Cuadrado", en: "Square" },
  "4:3": { es: "Horizontal 4:3", en: "Landscape 4:3" },
  "16:9": { es: "Horizontal 16:9 (banner)", en: "Landscape 16:9 (banner)" },
  "3:4": { es: "Feed 3:4", en: "Feed 3:4" },
  "9:16": { es: "Vertical 9:16 (stories)", en: "Vertical 9:16 (stories)" },
};
const RATIO_OPTIONS = [
  { value: "1:1", w: 1, h: 1, labelEs: "Cuadrado", labelEn: "Square" },
  { value: "4:3", w: 4, h: 3, labelEs: "Horizontal", labelEn: "Landscape" },
  { value: "16:9", w: 16, h: 9, labelEs: "Banner", labelEn: "Banner" },
  { value: "3:4", w: 3, h: 4, labelEs: "Feed", labelEn: "Feed" },
  { value: "9:16", w: 9, h: 16, labelEs: "Stories", labelEn: "Stories" },
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
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-wit-ink/15 bg-white px-4 py-2.5 text-left shadow-lg hover:bg-wit-mist/40"
    >
      <span className="block text-[10px] font-bold uppercase tracking-wide text-wit-gray">
        {t("Usaste antes", "You used before")}
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
  const { t } = useLanguage();
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
      setError(
        t(
          "Revisa los campos obligatorios: título, empresa y qué quieres en la pieza.",
          "Check the required fields: title, company and what you want in the piece.",
        ),
      );
      return;
    }
    if (!logoLocked && !noLogo && !useSameLogo && !logoFile) {
      setError(
        t(
          "Sube tu logotipo, marca 'No tengo logotipo' o usa el de tu solicitud anterior.",
          "Upload your logo, check 'I have no logo' or use the one from your previous request.",
        ),
      );
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
          setError(
            t(
              "No pudimos subir tu logotipo (PNG, JPG o WebP, máx. 8 MB).",
              "We could not upload your logo (PNG, JPG or WebP, max. 8 MB).",
            ),
          );
          setLoading(false);
          return;
        }
      }

      let productPhotoKey: string | undefined;
      if (productPhotoFile) {
        productPhotoKey = await upload(productPhotoFile);
        if (!productPhotoKey) {
          setError(
            t(
              "No pudimos subir la foto del producto (PNG, JPG o WebP, máx. 8 MB).",
              "We could not upload the product photo (PNG, JPG or WebP, max. 8 MB).",
            ),
          );
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
            ? t(
                "Ya usaste todas tus solicitudes disponibles.",
                "You have already used all your available requests.",
              )
            : data.error === "sin_membresia"
              ? t(
                  "Necesitas una membresía activa para enviar solicitudes.",
                  "You need an active membership to send requests.",
                )
              : t("Revisa los campos obligatorios.", "Check the required fields."),
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
      setOkMsg(
        t(
          "Solicitud enviada. El equipo WITERS ya está trabajando en ella.",
          "Request sent. The WITERS team is already working on it.",
        ),
      );
      onCreated();
    } catch {
      setError(
        t(
          "No pudimos enviar tu solicitud. Intenta de nuevo.",
          "We could not send your request. Try again.",
        ),
      );
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  if (step === "preview") {
    const previewAspectRatioLabel = RATIO_LABEL[form.aspectRatio];
    return (
      <section className="wit-glass h-fit rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
        <h2 className="text-xl font-bold text-wit-ink">
          {t("Revisa tu solicitud", "Review your request")}
        </h2>
        <p className="mt-1 text-sm text-wit-gray">
          {t(
            "Confirma que todo esté correcto antes de enviarla — usa una de tus solicitudes disponibles.",
            "Confirm everything is correct before sending it — this uses one of your available requests.",
          )}
        </p>

        <dl className="mt-6 space-y-4">
          <PreviewRow label={t("Título", "Title")} value={form.title} />
          <PreviewRow
            label={t("Nombre comercial / empresa", "Business / company name")}
            value={form.companyName}
          />
          {form.productName ? (
            <PreviewRow label={t("Nombre del producto", "Product name")} value={form.productName} />
          ) : null}
          <PreviewRow
            label={t("Qué quieres que salga en esta pieza", "What you want in this piece")}
            value={form.pieceBrief}
          />
          {form.audience ? (
            <PreviewRow label={t("Público objetivo", "Target audience")} value={form.audience} />
          ) : null}
          {ageRanges.length ? (
            <PreviewRow label={t("Rango de edad", "Age range")} value={ageRanges.join(", ")} />
          ) : null}
          {form.promoPrice ? (
            <PreviewRow
              label={t("Precio o descuento", "Price or discount")}
              value={form.promoPrice}
            />
          ) : null}
          {form.requiredText ? (
            <PreviewRow
              label={t("Mensaje o dato extra", "Message or extra detail")}
              value={form.requiredText}
            />
          ) : null}
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
              {t("Colores de marca", "Brand colors")}
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
          {form.style ? <PreviewRow label={t("Estilo", "Style")} value={form.style} /> : null}
          <PreviewRow
            label={t("Formato", "Format")}
            value={
              previewAspectRatioLabel
                ? t(previewAspectRatioLabel.es, previewAspectRatioLabel.en)
                : form.aspectRatio
            }
          />
          <PreviewRow
            label={t("Logotipo", "Logo")}
            value={
              logoLocked
                ? t("Tu logotipo registrado", "Your registered logo")
                : noLogo
                  ? t("No tiene logotipo", "No logo")
                  : useSameLogo
                    ? t(
                        "Mismo logotipo de tu solicitud anterior",
                        "Same logo as your previous request",
                      )
                    : (logoFile?.name ?? "")
            }
          />
          {productPhotoFile ? (
            <PreviewRow
              label={t("Foto del producto", "Product photo")}
              value={productPhotoFile.name}
            />
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
            {t("Editar", "Edit")}
          </button>
          <button
            type="button"
            onClick={confirmSend}
            disabled={disabled || loading}
            className="flex-1 rounded-2xl bg-wit-blue px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t("Enviando...", "Sending...") : t("Confirmar y enviar", "Confirm and send")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="wit-glass h-fit rounded-3xl p-7 shadow-[0_20px_60px_rgba(5,13,40,0.07)]">
      <h2 className="text-xl font-bold text-wit-ink">
        {t("Nueva solicitud de diseño", "New design request")}
      </h2>
      <p className="mt-1 text-sm text-wit-gray">
        {t(
          "Describe la creatividad publicitaria que necesitas y nuestro equipo la trabaja, con IA como herramienta de apoyo. Tu solicitud se entrega en un máximo de 3 días hábiles.",
          "Describe the advertising creative you need and our team works on it, with AI as a support tool. Your request is delivered within a maximum of 3 business days.",
        )}
      </p>

      <form onSubmit={goToPreview} className="mt-6 space-y-4">
        <div className="relative">
          <label htmlFor="rtitle" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Título", "Title")}
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
            placeholder={t("Anuncio de lanzamiento para Instagram", "Launch ad for Instagram")}
          />
          {activeSuggestion === "title" && previousAnswers?.title ? (
            <FieldSuggestion text={previousAnswers.title} onPick={() => pickSuggestion("title")} />
          ) : null}
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          {t("Sobre tu empresa", "About your company")}
        </p>
        <div className="relative">
          <label htmlFor="rcompany" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Nombre comercial / de la empresa", "Business / company name")}
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
            placeholder={t(
              "El nombre que va impreso en la pieza",
              "The name that goes printed on the piece",
            )}
          />
          {brandProfile ? (
            <p className="mt-1.5 text-xs text-wit-gray">
              {t(
                "Tu empresa ya está registrada. Escríbenos si necesitas cambiarla.",
                "Your company is already registered. Message us if you need to change it.",
              )}
            </p>
          ) : activeSuggestion === "companyName" && previousAnswers?.companyName ? (
            <FieldSuggestion
              text={previousAnswers.companyName}
              onPick={() => pickSuggestion("companyName")}
            />
          ) : null}
        </div>
        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          {t("Sobre este pedido", "About this request")}
        </p>
        <div className="relative">
          <label htmlFor="rproduct" className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Nombre del producto", "Product name")}{" "}
            <span className="font-normal text-wit-gray">{t("(opcional)", "(optional)")}</span>
          </label>
          <input
            id="rproduct"
            type="text"
            maxLength={120}
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            {...suggestionHandlers("productName")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder={t(
              "Si aplica a un producto en particular",
              "If it applies to a specific product",
            )}
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
            {t("Qué quieres que salga en esta pieza", "What you want in this piece")}
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
            placeholder={t(
              "Describe el concepto de esta pieza: qué debe mostrar, la idea principal...",
              "Describe the concept for this piece: what it should show, the main idea...",
            )}
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
            {t("Público objetivo", "Target audience")}{" "}
            <span className="font-normal text-wit-gray">{t("(opcional)", "(optional)")}</span>
          </label>
          <input
            id="raudience"
            type="text"
            maxLength={200}
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            {...suggestionHandlers("audience")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder={t(
              "Ej. mujeres emprendedoras, dueños de restaurantes...",
              "E.g. women entrepreneurs, restaurant owners...",
            )}
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
            {t("Rango de edad", "Age range")}{" "}
            <span className="font-normal text-wit-gray">
              {t("(opcional, elige uno o varios)", "(optional, choose one or several)")}
            </span>
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
            {t("Precio o descuento", "Price or discount")}{" "}
            <span className="font-normal text-wit-gray">{t("(opcional)", "(optional)")}</span>
          </label>
          <input
            id="rpromo"
            type="text"
            maxLength={80}
            value={form.promoPrice}
            onChange={(e) => setForm({ ...form, promoPrice: e.target.value })}
            {...suggestionHandlers("promoPrice")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder={t("Ej. $500, 20% de descuento...", "E.g. $500, 20% off...")}
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
            {t("Mensaje o dato extra", "Message or extra detail")}{" "}
            <span className="font-normal text-wit-gray">{t("(opcional)", "(optional)")}</span>
          </label>
          <input
            id="rreqtext"
            type="text"
            maxLength={500}
            value={form.requiredText}
            onChange={(e) => setForm({ ...form, requiredText: e.target.value })}
            {...suggestionHandlers("requiredText")}
            className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
            placeholder={t(
              "Ej. válido hasta el 31 de julio, nombre de la promoción...",
              "E.g. valid until July 31, name of the promotion...",
            )}
          />
          {activeSuggestion === "requiredText" && previousAnswers?.requiredText ? (
            <FieldSuggestion
              text={previousAnswers.requiredText}
              onPick={() => pickSuggestion("requiredText")}
            />
          ) : null}
          <p className="mt-1.5 text-xs text-wit-gray">
            {t(
              "Si lo dejas vacío, nuestro equipo de diseño se encarga de la redacción.",
              "If you leave it blank, our design team takes care of the copy.",
            )}
          </p>
        </div>
        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          {t("Marca y estilo", "Brand and style")}
        </p>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            {t("Colores de marca", "Brand colors")}{" "}
            {brandProfile ? null : (
              <span className="font-normal text-wit-gray">
                {t("(hasta 3, opcional)", "(up to 3, optional)")}
              </span>
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
              <p className="text-xs text-wit-gray">
                {t(
                  "Tus colores de marca ya están registrados.",
                  "Your brand colors are already registered.",
                )}
              </p>
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
                    aria-label={t(`Color ${i + 1}`, `Color ${i + 1}`)}
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
                    aria-label={t(
                      `Código hexadecimal del color ${i + 1}`,
                      `Hex code for color ${i + 1}`,
                    )}
                  />
                  {colors.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setColors(colors.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-wit-ink text-[10px] leading-none text-white"
                      aria-label={t("Quitar color", "Remove color")}
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
                  aria-label={t("Agregar color", "Add color")}
                >
                  +
                </button>
              ) : null}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-wit-ink">
            {t("Estilo deseado", "Desired style")}{" "}
            <span className="font-normal text-wit-gray">{t("(opcional)", "(optional)")}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLE_CHIPS.map((s) => (
              <ChipButton
                key={s.value}
                label={t(s.labelEs, s.labelEn)}
                active={form.style === s.value}
                onClick={() => setForm({ ...form, style: form.style === s.value ? "" : s.value })}
              />
            ))}
          </div>
          <div className="relative mt-2">
            <input
              type="text"
              maxLength={200}
              value={STYLE_CHIPS.some((s) => s.value === form.style) ? "" : form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              {...suggestionHandlers("style")}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-base outline-none focus:border-wit-blue"
              placeholder={t(
                "U otro estilo en tus palabras...",
                "Or another style in your own words...",
              )}
            />
            {activeSuggestion === "style" && previousAnswers?.style ? (
              <FieldSuggestion
                text={previousAnswers.style}
                onPick={() => pickSuggestion("style")}
              />
            ) : null}
          </div>
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          {t("Archivos", "Files")}
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-wit-ink">
            {t("Logotipo", "Logo")}
          </label>
          {logoLocked ? (
            <div className="flex items-center gap-3 rounded-xl border border-wit-ink/15 px-4 py-3">
              <img
                src={`/api/file?key=${encodeURIComponent(brandProfile!.logo_key!)}`}
                alt=""
                className="h-10 w-10 rounded-lg border border-wit-ink/10 object-cover"
              />
              <p className="text-sm text-wit-gray">
                {t(
                  "Este es tu logotipo registrado. Escríbenos si necesitas cambiarlo.",
                  "This is your registered logo. Message us if you need to change it.",
                )}
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
                  {t(
                    "Utilizar el logotipo de la solicitud anterior",
                    "Use the logo from your previous request",
                  )}
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
                {t("No tengo logotipo", "I have no logo")}
              </label>
            </>
          )}
        </div>
        <div>
          <label
            htmlFor="rproductphoto"
            className="mb-1.5 block text-sm font-semibold text-wit-ink"
          >
            {t("Foto del producto", "Product photo")}{" "}
            <span className="font-normal text-wit-gray">{t("(opcional)", "(optional)")}</span>
          </label>
          <input
            id="rproductphoto"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setProductPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-dashed border-wit-ink/20 px-4 py-3 text-sm text-wit-gray file:mr-3 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-wit-blue"
          />
        </div>

        <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          {t("Formato", "Format")}
        </p>
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
                <span className="text-[10px] leading-none text-wit-gray">
                  {t(r.labelEs, r.labelEn)}
                </span>
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
          {t("Continuar", "Continue")}
        </button>
        {disabled ? (
          <p className="text-center text-xs text-wit-gray">
            {t(
              "Necesitas membresía activa y solicitudes disponibles.",
              "You need an active membership and available requests.",
            )}
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
  const { t } = useLanguage();
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
          <p className="text-base font-semibold text-wit-ink">
            {t("Aún no tienes solicitudes.", "You don't have any requests yet.")}
          </p>
          <p className="mt-1 text-sm text-wit-gray">
            {t(
              "Envía tu primera solicitud y aparecerá aquí con su estado.",
              "Send your first request and it will show up here with its status.",
            )}
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-5 rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
          >
            {t("Enviar mi primera solicitud", "Send my first request")}
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
  const { t } = useLanguage();
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
          {t("← Ocultar detalle", "← Hide detail")}
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
          {t("Formato", "Format")} {r.aspect_ratio} ·{" "}
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
        {r.status === "en_proceso" || r.status === "cambio_solicitado" ? (
          <Spinner cls="border-amber-600" />
        ) : null}
        {t(st.es, st.en)}
      </span>
    </button>
  );

  return r.status === "en_proceso" || r.status === "cambio_solicitado" ? (
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
  const { t } = useLanguage();
  const qc = useQueryClient();
  const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.en_proceso;
  // The API only ever returns the single most recent delivered file, and
  // only while status is "completada" (server-enforced in /api/file too).
  const latestResult = parseResults(r).at(-1) ?? null;
  const [revisionText, setRevisionText] = useState("");
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
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
  const steps: { es: string; en: string; detail: string | null }[] = [
    { es: "Solicitud enviada", en: "Request sent", detail: null },
  ];
  if (r.revision_note_1) steps.push({ es: "Cambio 1", en: "Change 1", detail: r.revision_note_1 });
  if (r.revision_note_2) steps.push({ es: "Cambio 2", en: "Change 2", detail: r.revision_note_2 });

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
        // "Correcto, finalizar solicitud" is just as much a satisfaction
        // signal as clicking download inside the lightbox — a client who
        // clicks this (very plausibly after approving a revision, since
        // it reads as the "I'm done" button) was never getting the survey
        // at all, only the download path triggered it.
        if (!alreadyRated) onDownloadFinalized?.();
      } else {
        setMsg(
          t(
            "No pudimos finalizar la solicitud. Intenta de nuevo.",
            "We couldn't finalize the request. Please try again.",
          ),
        );
      }
    } catch {
      setMsg(
        t(
          "No pudimos finalizar la solicitud. Intenta de nuevo.",
          "We couldn't finalize the request. Please try again.",
        ),
      );
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
      setMsg(
        t(
          "Cuéntanos con un poco más de detalle qué quieres ajustar.",
          "Tell us in a bit more detail what you'd like adjusted.",
        ),
      );
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
        setSentMsg(
          t(
            "Tu solicitud de cambio ha sido enviada. El equipo ya está trabajando en ella.",
            "Your change request has been sent. The team is already working on it.",
          ),
        );
        await qc.invalidateQueries({ queryKey: ["requests"] });
      } else {
        setMsg(
          t(
            "No pudimos enviar tu solicitud de cambio. Intenta de nuevo.",
            "We couldn't send your change request. Please try again.",
          ),
        );
      }
    } catch {
      setMsg(
        t(
          "No pudimos enviar tu solicitud de cambio. Intenta de nuevo.",
          "We couldn't send your change request. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function reportChange() {
    if (changeText.trim().length < 5) {
      setMsg(
        t(
          "Cuéntanos con un poco más de detalle cuál es el error.",
          "Tell us in a bit more detail what the error is.",
        ),
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/request-change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: r.id, message: changeText }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setChangeText("");
        setShowChangeForm(false);
        setSentMsg(
          t(
            "Recibimos tu reporte. El equipo lo va a revisar antes de retomar la pieza.",
            "We received your report. The team will review it before resuming the piece.",
          ),
        );
        await qc.invalidateQueries({ queryKey: ["requests"] });
      } else {
        setMsg(
          t(
            "No pudimos enviar tu reporte. Intenta de nuevo.",
            "We couldn't send your report. Please try again.",
          ),
        );
      }
    } catch {
      setMsg(
        t(
          "No pudimos enviar tu reporte. Intenta de nuevo.",
          "We couldn't send your report. Please try again.",
        ),
      );
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
          {t(st.es, st.en)}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-wit-gray">
        {t("Formato", "Format")} {r.aspect_ratio} ·{" "}
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
              key={s.es}
              className="flex items-center gap-3 rounded-xl bg-wit-ice/60 px-4 py-2.5"
            >
              {isLast && (r.status === "en_proceso" || r.status === "cambio_solicitado") ? (
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
              <span className="flex-1 text-sm font-semibold text-wit-ink">{t(s.es, s.en)}</span>
              <span
                className={`text-xs font-bold ${
                  isLast
                    ? r.status === "en_proceso" || r.status === "cambio_solicitado"
                      ? "text-wit-blue"
                      : r.status === "rechazada"
                        ? "text-red-600"
                        : r.status === "cerrada"
                          ? "text-wit-blue"
                          : "text-emerald-600"
                    : "text-emerald-600"
                }`}
              >
                {isLast ? t(st.es, st.en) : t("Listo", "Done")}
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
        {showDetail ? t("Ocultar detalle", "Hide detail") : t("Ver detalle", "View detail")}
      </button>
      {showDetail ? (
        <div className="mt-2 space-y-2 rounded-xl bg-wit-mist/30 p-4 text-sm text-wit-gray">
          <p>
            <strong className="text-wit-ink">{t("Lo que pediste:", "What you asked for:")}</strong>{" "}
            {r.brief}
          </p>
          {r.piece_brief ? (
            <p>
              <strong className="text-wit-ink">{t("Para esta pieza:", "For this piece:")}</strong>{" "}
              {r.piece_brief}
            </p>
          ) : null}
          {steps
            .filter((s) => s.detail)
            .map((s) => (
              <p key={s.es}>
                <strong className="text-wit-ink">{t(s.es, s.en)}:</strong> {s.detail}
              </p>
            ))}
        </div>
      ) : null}

      {r.admin_note ? (
        <p className="mt-3 rounded-xl bg-wit-mist/40 px-4 py-2.5 text-sm text-wit-ink">
          <strong>{t("Nota del equipo:", "Team note:")}</strong> {r.admin_note}
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
                alt={t(`Resultado de ${r.title}`, `Result for ${r.title}`)}
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
                  {r.status === "completada"
                    ? t("Ver y descargar", "View and download")
                    : t("Ver imagen", "View image")}
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
              {t("Qué quieres que ajustemos", "What you'd like us to adjust")} ({revisionsLeft}{" "}
              {revisionsLeft === 1
                ? t("cambio disponible", "change available")
                : t("cambios disponibles", "changes available")}
              )
            </label>
            <div className="relative">
              <textarea
                rows={3}
                maxLength={1000}
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                className="w-full resize-y rounded-lg border border-wit-ink/15 bg-white px-3 py-2 pr-12 text-sm outline-none focus:border-wit-blue"
                placeholder={t(
                  "Ej. cambiar el color de fondo a azul, agrandar el texto...",
                  "E.g. change the background color to blue, make the text bigger...",
                )}
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
                {busy
                  ? t("Enviando...", "Sending...")
                  : t("Enviar solicitud de cambio", "Send change request")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowRevisionForm(false)}
                className="text-sm font-semibold text-wit-gray hover:text-wit-ink"
              >
                {t("Cancelar", "Cancel")}
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
              {closing
                ? t("Finalizando...", "Finalizing...")
                : t("✓ Correcto, finalizar solicitud", "✓ Correct, finalize request")}
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
                {t("Solicitar cambio", "Request change")} ({revisionsLeft}{" "}
                {revisionsLeft === 1 ? t("disponible", "available") : t("disponibles", "available")}
                )
              </button>
            ) : null}
            {msg ? <p className="w-full text-sm text-red-600">{msg}</p> : null}
          </div>
        )
      ) : null}

      {r.status === "cerrada" ? (
        showChangeForm ? (
          <div className="mt-4 rounded-xl bg-wit-ice p-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-wit-gray">
              {t("Qué error notaste en la pieza", "What error did you notice in the piece")}
            </label>
            <div className="relative">
              <textarea
                rows={3}
                maxLength={1000}
                value={changeText}
                onChange={(e) => setChangeText(e.target.value)}
                className="w-full resize-y rounded-lg border border-wit-ink/15 bg-white px-3 py-2 pr-12 text-sm outline-none focus:border-wit-blue"
                placeholder={t(
                  "Ej. el nombre de la empresa está mal escrito, el color no es el correcto...",
                  "E.g. the company name is misspelled, the color isn't right...",
                )}
              />
              <MicButton
                value={changeText}
                onChange={setChangeText}
                className="absolute bottom-2 right-2"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={reportChange}
                className="rounded-full bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
              >
                {busy ? t("Enviando...", "Sending...") : t("Enviar reporte", "Send report")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowChangeForm(false)}
                className="text-sm font-semibold text-wit-gray hover:text-wit-ink"
              >
                {t("Cancelar", "Cancel")}
              </button>
            </div>
            {msg ? <p className="mt-2 text-sm text-red-600">{msg}</p> : null}
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setSentMsg(null);
                setShowChangeForm(true);
              }}
              className="rounded-full border border-wit-ink/15 px-4 py-2 text-sm font-semibold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
            >
              {t("Solicitar cambio por error en la pieza", "Report an error in the piece")}
            </button>
          </div>
        )
      ) : null}

      {r.status === "cambio_solicitado" ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {t(
            "Tu reporte está en revisión por el equipo de WITERS. En cuanto lo aprobemos, el equipo de diseño retoma la pieza.",
            "Your report is under review by the WITERS team. As soon as we approve it, the design team will resume the piece.",
          )}
        </p>
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
  const { t } = useLanguage();
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
            {downloading
              ? t("Descargando...", "Downloading...")
              : t("Descargar imagen", "Download image")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            {t("Cerrar", "Close")}
          </button>
        </div>
        {willFinalize ? (
          <p className="mt-3 max-w-xs text-center text-xs text-white/70">
            {t(
              "Si descargas la imagen, tu solicitud se dará por finalizada. Solo puedes descargar una versión.",
              "If you download the image, your request will be marked as finalized. You can only download one version.",
            )}
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
  const { t } = useLanguage();
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
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        {step === "rate" ? (
          <>
            <h3 className="text-lg font-bold text-wit-ink">
              {t(
                "¿Qué tan satisfecho quedaste con esta pieza?",
                "How satisfied were you with this piece?",
              )}
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
              {t("Ahora no", "Not now")}
            </button>
          </>
        ) : step === "feedback" ? (
          <>
            <h3 className="text-lg font-bold text-wit-ink">
              {rating === 5
                ? t("¿Qué fue lo que más te gustó?", "What did you like the most?")
                : t("¿Cómo podemos mejorar?", "How can we improve?")}
            </h3>
            <p className="mt-1 text-sm text-wit-gray">
              {rating === 5
                ? t(
                    "Nos encantaría saber qué te encantó de tu pieza.",
                    "We'd love to know what you loved about your piece.",
                  )
                : t("Cuéntanos qué fue lo que no te gustó.", "Tell us what you didn't like.")}
            </p>
            <textarea
              rows={4}
              maxLength={1000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                rating === 5
                  ? t(
                      "Tu comentario nos ayuda a seguir así (opcional)",
                      "Your comment helps us keep it up (optional)",
                    )
                  : t(
                      "Tu comentario nos ayuda a mejorar (opcional)",
                      "Your comment helps us improve (optional)",
                    )
              }
              className="mt-4 w-full resize-y rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={sendFeedback}
              className="mt-4 w-full rounded-2xl bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
            >
              {submitting ? t("Enviando...", "Sending...") : t("Enviar comentario", "Send comment")}
            </button>
          </>
        ) : (
          <>
            {rating === 5 ? (
              <>
                <p className="text-4xl">✨</p>
                <h3 className="mt-3 text-lg font-bold text-wit-ink">{t("Gracias", "Thank you")}</h3>
                <p className="mt-2 text-sm text-wit-gray">
                  {t(
                    "Nos encanta que tu pieza haya quedado tal como la imaginabas. Gracias por confiar en WITERS.",
                    "We're glad your piece turned out just as you imagined. Thank you for trusting WITERS.",
                  )}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-wit-ink">
                  {t("Gracias por tu comentario", "Thank you for your comment")}
                </h3>
                <p className="mt-2 text-sm text-wit-gray">
                  {t(
                    "Lo vamos a tomar en cuenta para que tus próximas piezas queden mejor.",
                    "We'll take it into account so your next pieces come out even better.",
                  )}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={onDone}
              className="mt-6 rounded-full bg-wit-blue px-8 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
            >
              {t("Listo", "Done")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
