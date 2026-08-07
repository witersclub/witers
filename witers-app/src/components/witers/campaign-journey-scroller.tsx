// Scroll-pinned "one piece becomes a whole campaign" sequence for /pauta's
// hero: the existing MetaAdsDashboardCard + WhatsAppPhoneMockup pairing
// slides left, and three new phone mockups fan out to its right — the
// client's panel (request the piece), the live ad (Meta's own "Enviar
// mensaje" CTA), and the WhatsApp inbox that CTA lands in. All three reuse
// the same illustrated gradient card as "the piece" so it reads as one
// image traveling through the whole system, not three unrelated screens.
// Desktop-only (lg+): a pinned-scroll rig like this fights mobile's address
// bar collapse and momentum scrolling, so small screens keep the plain
// centered mockup instead (see Hero() in pauta.tsx).
import { Link } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { MessageCircle, Rocket, Sparkles } from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { useMe } from "../../lib/witers-client";
import { MetaAdsDashboardCard, WhatsAppPhoneMockup } from "./meta-ads-card";

// The three "Boutique Alma" piece gradients already established on the
// homepage showcase (panel-preview-showcase.tsx's InicioScreen) — reusing
// them here instead of inventing new colors keeps every mockup across the
// site telling the same visual story. Index 0 (rose) is "the" piece that
// the ad and WhatsApp screens feature; the gallery in the panel screen
// shows a mix of all three, like a real client's past requests would.
const PIECE_GRADIENTS = [
  "linear-gradient(135deg,#C97B84,#8a4f57)",
  "linear-gradient(135deg,#B08D57,#6e5730)",
  "linear-gradient(135deg,#2B2320,#544738)",
];

function PieceThumb({ className = "", variant = 0 }: { className?: string; variant?: 0 | 1 | 2 }) {
  return (
    <div
      className={`shrink-0 rounded-lg ${className}`}
      style={{ background: PIECE_GRADIENTS[variant] }}
    />
  );
}

function MiniPhone({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="absolute left-1/2 top-1/2 w-[218px] shrink-0"
      style={{ transform: "translate(-50%,-50%)", ...style }}
    >
      <div className="rounded-[1.9rem] border-[7px] border-wit-ink bg-wit-ink shadow-[0_30px_65px_rgba(5,13,40,0.3)]">
        <div className="relative h-[420px] overflow-hidden rounded-[1.3rem] bg-white">
          <div className="absolute left-1/2 top-0 z-20 h-4 w-[72px] -translate-x-1/2 rounded-b-xl bg-wit-ink" />
          {children}
        </div>
      </div>
    </div>
  );
}

// Same phone chrome as MiniPhone, but laid out in normal flow instead of
// absolutely centered — for the mobile version of the journey, where the
// three steps stack vertically instead of splitting apart on a pin.
function StaticPhone({ children }: { children: ReactNode }) {
  return (
    <div className="w-[210px] shrink-0 rounded-[1.9rem] border-[7px] border-wit-ink bg-wit-ink shadow-[0_30px_65px_rgba(5,13,40,0.3)] sm:w-[230px]">
      <div className="relative h-[406px] overflow-hidden rounded-[1.3rem] bg-white sm:h-[444px]">
        <div className="absolute left-1/2 top-0 z-20 h-4 w-[72px] -translate-x-1/2 rounded-b-xl bg-wit-ink" />
        {children}
      </div>
    </div>
  );
}

function PanelScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col justify-between px-3.5 pb-3.5 pt-8">
      <div>
        <p className="text-[13px] font-extrabold text-wit-ink">
          {t("Hola,", "Hi,")} <span className="text-wit-blue">Alma</span>
        </p>
        <p className="mt-2.5 text-[8.5px] font-bold text-wit-ink">
          {t("Mis solicitudes", "My requests")}
        </p>
        <div className="mt-2 flex gap-2">
          <PieceThumb className="h-[70px] w-[52px]" variant={0} />
          <PieceThumb className="h-[70px] w-[52px]" variant={1} />
          <PieceThumb className="h-[70px] w-[52px]" variant={2} />
        </div>
        <div className="mt-3 rounded-xl bg-wit-mist/30 px-2.5 py-2">
          <p className="text-[6.5px] font-bold uppercase tracking-wide text-wit-gray">
            {t("Tu cupo este mes", "Your quota this month")}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
              <div className="h-full w-2/3 rounded-full bg-wit-blue" />
            </div>
            <span className="text-[6.5px] font-bold text-wit-gray">14/20</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        tabIndex={-1}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-wit-blue py-2.5 text-[9.5px] font-bold text-white"
      >
        <Rocket className="h-3 w-3" strokeWidth={2.4} />
        {t("Crear campaña", "Create campaign")}
      </button>
    </div>
  );
}

function AdFeedScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-white pt-8">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#C97B84,#8a4f57)] text-[8px] font-bold text-white">
          A
        </span>
        <div className="leading-tight">
          <p className="text-[9px] font-bold text-wit-ink">Boutique Alma</p>
          <p className="text-[7px] text-wit-gray">{t("Patrocinado", "Sponsored")}</p>
        </div>
      </div>
      <PieceThumb className="mx-3 h-[220px] rounded-md" />
      <p className="px-3 pt-2 text-[8.5px] leading-snug text-wit-ink">
        {t("Vestidos nuevos ya disponibles ✨", "New dresses now available ✨")}
      </p>
      <div className="mt-auto flex items-center justify-center gap-1.5 border-t border-wit-ink/10 px-3 py-3">
        <MessageCircle className="h-3.5 w-3.5 text-wit-blue" strokeWidth={2.2} />
        <span className="text-[9.5px] font-bold text-wit-blue">
          {t("Enviar mensaje", "Send message")}
        </span>
      </div>
    </div>
  );
}

function WhatsAppScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-[#e5ddd5] pt-8">
      <div className="flex items-center gap-1.5 bg-[#128C7E] px-3 pb-2 pt-1.5 text-white">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[8px] font-bold">
          A
        </span>
        <p className="text-[9px] font-semibold">Boutique Alma</p>
      </div>
      <div className="flex flex-col gap-2 px-2.5 py-2.5">
        <div className="max-w-[78%] overflow-hidden rounded-lg rounded-tl-none bg-white shadow-sm">
          <PieceThumb className="h-[78px] w-full rounded-none" />
          <p className="px-2 py-1.5 text-[8px] leading-snug text-wit-ink">
            {t("Vestidos nuevos ya disponibles ✨", "New dresses now available ✨")}
          </p>
        </div>
        <div className="max-w-[78%] rounded-lg rounded-tl-none bg-white px-2 py-1.5 text-[8.5px] leading-snug text-wit-ink shadow-sm">
          {t("Hola! Quiero más información 👋", "Hi! I want more information 👋")}
        </div>
      </div>
    </div>
  );
}

const NEW_PHONES = [
  {
    key: "panel",
    screen: <PanelScreen />,
    endX: -270,
    label: { es: "Creamos tu pieza publicitaria", en: "We create your ad piece" },
  },
  {
    key: "anuncio",
    screen: <AdFeedScreen />,
    endX: 0,
    label: { es: "Creamos tu campaña en Meta Ads", en: "We create your Meta Ads campaign" },
  },
  {
    key: "whatsapp",
    screen: <WhatsAppScreen />,
    endX: 270,
    label: {
      es: "Empiezas a recibir mensajes a tu WhatsApp",
      en: "You start getting messages on your WhatsApp",
    },
  },
];

// progress: 0 = section just entered the pinned range, 1 = fully scrolled
// through it. Shared with any other scroll-pinned reveal on the site (see
// redes.tsx's step-by-step scroller) so the same scroll-tracking math isn't
// duplicated per section.
export function useScrollProgress(sectionRef: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const compute = () => {
      ticking = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const raw = -rect.top / scrollable;
      setProgress(Math.min(1, Math.max(0, raw)));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sectionRef]);

  return progress;
}

// Gentle smoothstep, not an aggressive ease-out — the split should track
// the scroll wheel closely across the whole pinned range instead of
// finishing in the first third and leaving a long "dead" scroll after.
export const smoothstep = (x: number) => x * x * (3 - 2 * x);

export function CampaignJourneyScroller() {
  const { t } = useLanguage();
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(sectionRef);

  const splitT = smoothstep(progress);
  const comboShift = -90 * splitT;

  return (
    <div ref={sectionRef} className="relative mt-10 hidden lg:block" style={{ height: "180vh" }}>
      {/* No overflow-hidden here — clipping this box cut off the top of the
          Meta Ads card above. Generously tall instead, so real content is
          simply never at risk of being cropped. mt-10 on the wrapper (not
          the sticky offset) keeps a fixed gap under the badge above no
          matter how tall the viewport is. */}
      <div className="sticky top-12 h-[780px]">
        {/* Anchored from the top, not vertically centered — with the
            headline now stacked underneath it, this column got tall
            enough that centering it pushed its top edge above the box
            (and into the badge/header above). */}
        <div
          className="absolute left-[16%] top-10 w-[380px]"
          style={{ transform: `translate(${comboShift}px,0)` }}
        >
          <div className="relative pb-8 pl-8 pt-4">
            <MetaAdsDashboardCard />
            <WhatsAppPhoneMockup className="absolute -bottom-6 -left-2 z-10" />
          </div>

          {/* The headline lives right under its own mockup instead of
              centered in its own full-width band below everything — the
              hero reads as one horizontal composition (piece → campaign →
              conversation) instead of "mockups on top, huge text block
              wasting space underneath." Mobile keeps the original centered
              block (see Hero() in pauta.tsx). */}
          <div className="relative z-20 mt-16 pl-8">
            <h1 className="text-3xl font-extrabold leading-[1.08] tracking-tighter text-wit-ink">
              {t("De la pieza a la", "From creative to")}{" "}
              <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
                {t("campaña", "campaign")}
              </span>
              .
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-wit-gray">
              {t(
                "El equipo de WITERS convierte tus creatividades en una campaña real de Meta Ads, configurada en minutos y en pausa hasta que tú decidas encenderla.",
                "The WITERS team turns your creatives into a real Meta Ads campaign, set up in minutes and paused until you decide to switch it on.",
              )}
            </p>
            <Link
              to={signedIn ? "/panel" : "/registro"}
              className="group mt-5 inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-6 py-3 text-sm font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
            >
              {t("Quiero pautar mis campañas", "I want to run my campaigns")}
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
              >
                <path d="M3 13 13 3M13 3H6M13 3v7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* The panel phone (index 0) is the anchor: solid and opaque from
            frame one, "the one screen" the sequence starts as. The ad and
            WhatsApp phones are invisible until they peel off from behind
            it, fading and growing in as they slide to their spot — no
            three-way ghost-overlap at rest. */}
        <div className="absolute inset-0">
          {/* Timeline connecting the 3 steps — grows outward from the
              center as the phones split, instead of three captions
              floating independently under each phone. Sits well clear of
              the phones' bottom edge (top-[calc(50%+270px)], not +234) so
              the markers don't crowd/hide behind the phone bezels. */}
          <div
            className="absolute h-0.5 -translate-y-1/2 bg-wit-blue/25"
            style={{
              top: "calc(50% + 270px)",
              left: `calc(72% + ${NEW_PHONES[0].endX * splitT}px)`,
              width: `${(NEW_PHONES[2].endX - NEW_PHONES[0].endX) * splitT}px`,
            }}
          />
          {NEW_PHONES.map((p, i) => {
            const isAnchor = i === 0;
            // Staggered, not simultaneous: step 2 reveals across the
            // first ~55% of the split, step 3 only starts once step 2 is
            // mostly in — so the timeline visibly builds 1 → 2 → 3 instead
            // of 2 and 3 popping in together.
            const revealStart = i === 2 ? 0.4 : 0;
            const revealT = isAnchor ? 1 : Math.min(1, Math.max(0, (splitT - revealStart) / 0.5));
            return (
              <div key={p.key} className="absolute inset-0">
                <MiniPhone
                  style={{
                    left: `calc(72% + ${p.endX * splitT}px)`,
                    opacity: revealT,
                    scale: `${0.88 + 0.12 * revealT}`,
                    zIndex: isAnchor ? 3 : 2,
                  }}
                >
                  {p.screen}
                </MiniPhone>
                <div
                  className="absolute flex flex-col items-center"
                  style={{
                    top: "calc(50% + 270px)",
                    left: `calc(72% + ${p.endX * splitT}px)`,
                    transform: "translate(-50%,-50%)",
                    opacity: revealT,
                  }}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wit-blue text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(0,71,255,0.35)]">
                    {i + 1}
                  </span>
                  <p className="mt-2.5 max-w-[190px] text-center text-xs font-bold leading-snug text-wit-ink">
                    {t(p.label.es, p.label.en)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {progress < 0.05 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-wit-gray">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
            {t("Sigue bajando", "Keep scrolling")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Mobile counterpart to CampaignJourneyScroller: the same three steps (piece
// → Meta Ads campaign → WhatsApp inbox), just stacked in normal flow with a
// connecting line instead of pinned/split by scroll — see the file banner
// above for why mobile skips the pinned-scroll rig entirely.
export function CampaignJourneyMobile() {
  const { t } = useLanguage();
  return (
    <div className="relative mt-14 flex flex-col items-center lg:hidden">
      {/* One continuous rail behind the whole stack — from step 1's badge
          down to the last phone — instead of a short segment per gap, so
          the three steps read as one connected line, not floating pieces. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-3 bottom-0 z-0 w-0.5 -translate-x-1/2 bg-wit-blue/25"
      />
      {NEW_PHONES.map((p, i) => (
        <div key={p.key} className="relative z-10 flex flex-col items-center">
          {i > 0 ? <div className="h-8" /> : null}
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wit-blue text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(0,71,255,0.35)]">
            {i + 1}
          </span>
          <p className="mt-2.5 max-w-[220px] text-center text-xs font-bold leading-snug text-wit-ink">
            {t(p.label.es, p.label.en)}
          </p>
          <div className="mt-4">
            <StaticPhone>{p.screen}</StaticPhone>
          </div>
        </div>
      ))}
    </div>
  );
}
