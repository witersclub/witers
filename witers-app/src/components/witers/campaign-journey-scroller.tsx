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
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { MessageCircle, Rocket, Sparkles } from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { MetaAdsDashboardCard, WhatsAppPhoneMockup } from "./meta-ads-card";

// The one visual that travels through all three phones — a rose/brown
// gradient card standing in for a real delivered piece, same illustrated
// treatment panel-preview-showcase.tsx uses for "Boutique Alma" elsewhere
// on the site, never an actual client's photo.
function PieceThumb({ className = "" }: { className?: string }) {
  return (
    <div
      className={`shrink-0 rounded-lg ${className}`}
      style={{ background: "linear-gradient(135deg,#C97B84,#8a4f57)" }}
    />
  );
}

function MiniPhone({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="absolute left-1/2 top-1/2 w-[186px] shrink-0"
      style={{ transform: "translate(-50%,-50%)", ...style }}
    >
      <div className="rounded-[1.7rem] border-[6px] border-wit-ink bg-wit-ink shadow-[0_30px_60px_rgba(5,13,40,0.28)]">
        <div className="relative h-[380px] overflow-hidden rounded-[1.2rem] bg-white">
          <div className="absolute left-1/2 top-0 z-20 h-3.5 w-16 -translate-x-1/2 rounded-b-xl bg-wit-ink" />
          {children}
        </div>
      </div>
    </div>
  );
}

function PanelScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col justify-between px-3 pb-3 pt-7">
      <div>
        <p className="text-[11px] font-extrabold text-wit-ink">
          {t("Hola,", "Hi,")} <span className="text-wit-blue">Alma</span>
        </p>
        <p className="mt-2 text-[7.5px] font-bold text-wit-ink">
          {t("Mis solicitudes", "My requests")}
        </p>
        <div className="mt-1.5 flex gap-1.5">
          <PieceThumb className="h-16 w-12" />
          <div className="h-16 w-12 shrink-0 rounded-lg border border-wit-ink/10 bg-wit-mist/30" />
          <div className="h-16 w-12 shrink-0 rounded-lg border border-wit-ink/10 bg-wit-mist/30" />
        </div>
      </div>
      <button
        type="button"
        tabIndex={-1}
        className="flex items-center justify-center gap-1 rounded-xl bg-wit-blue py-2 text-[8.5px] font-bold text-white"
      >
        <Rocket className="h-2.5 w-2.5" strokeWidth={2.4} />
        {t("Crear campaña", "Create campaign")}
      </button>
    </div>
  );
}

function AdFeedScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-white pt-7">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#C97B84,#8a4f57)] text-[7px] font-bold text-white">
          A
        </span>
        <div className="leading-tight">
          <p className="text-[8px] font-bold text-wit-ink">Boutique Alma</p>
          <p className="text-[6.5px] text-wit-gray">{t("Patrocinado", "Sponsored")}</p>
        </div>
      </div>
      <PieceThumb className="mx-2.5 h-[190px] rounded-md" />
      <p className="px-2.5 pt-2 text-[7.5px] leading-snug text-wit-ink">
        {t("Vestidos nuevos ya disponibles ✨", "New dresses now available ✨")}
      </p>
      <div className="mt-auto flex items-center justify-center gap-1 border-t border-wit-ink/10 px-2.5 py-2.5">
        <MessageCircle className="h-3 w-3 text-wit-blue" strokeWidth={2.2} />
        <span className="text-[8.5px] font-bold text-wit-blue">
          {t("Enviar mensaje", "Send message")}
        </span>
      </div>
    </div>
  );
}

function WhatsAppScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-[#e5ddd5] pt-7">
      <div className="flex items-center gap-1.5 bg-[#128C7E] px-2.5 pb-1.5 pt-1 text-white">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[7px] font-bold">
          A
        </span>
        <p className="text-[8px] font-semibold">Boutique Alma</p>
      </div>
      <div className="flex flex-col gap-1.5 px-2 py-2">
        <div className="max-w-[75%] overflow-hidden rounded-lg rounded-tl-none bg-white shadow-sm">
          <PieceThumb className="h-16 w-full rounded-none" />
          <p className="px-1.5 py-1 text-[7px] leading-snug text-wit-ink">
            {t("Vestidos nuevos ya disponibles ✨", "New dresses now available ✨")}
          </p>
        </div>
        <div className="max-w-[75%] rounded-lg rounded-tl-none bg-white px-1.5 py-1 text-[7.5px] leading-snug text-wit-ink shadow-sm">
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
    endX: -240,
    label: { es: "Pides la pieza", en: "You request the piece" },
  },
  {
    key: "anuncio",
    screen: <AdFeedScreen />,
    endX: 0,
    label: { es: "Se vuelve anuncio", en: "It becomes an ad" },
  },
  {
    key: "whatsapp",
    screen: <WhatsAppScreen />,
    endX: 240,
    label: { es: "Llega el mensaje", en: "The message arrives" },
  },
];

// progress: 0 = everything stacked/centered as one, 1 = fully split out.
function useScrollProgress(sectionRef: React.RefObject<HTMLDivElement | null>) {
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
const smoothstep = (x: number) => x * x * (3 - 2 * x);

export function CampaignJourneyScroller() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(sectionRef);

  const splitT = smoothstep(progress);
  const comboShift = -160 * splitT;

  return (
    <div ref={sectionRef} className="relative hidden lg:block" style={{ height: "180vh" }}>
      <div className="sticky top-20 h-[640px] overflow-hidden">
        <div
          className="absolute left-[18%] top-1/2 -translate-y-1/2"
          style={{ transform: `translate(${comboShift}px,-50%)` }}
        >
          <div className="relative w-[380px] pb-8 pl-8 pt-4">
            <MetaAdsDashboardCard />
            <WhatsAppPhoneMockup className="absolute -bottom-6 -left-2 z-10" />
          </div>
        </div>

        <div className="absolute inset-0">
          {NEW_PHONES.map((p) => (
            <div key={p.key} className="absolute inset-0">
              <MiniPhone
                style={{
                  left: `calc(68% + ${p.endX * splitT}px)`,
                  opacity: 0.15 + 0.85 * splitT,
                  scale: `${0.82 + 0.18 * splitT}`,
                }}
              >
                {p.screen}
              </MiniPhone>
              <p
                className="absolute top-[calc(50%+200px)] text-center text-xs font-bold text-wit-ink"
                style={{
                  left: `calc(68% + ${p.endX * splitT}px)`,
                  transform: "translateX(-50%)",
                  opacity: splitT > 0.7 ? (splitT - 0.7) / 0.3 : 0,
                }}
              >
                {t(p.label.es, p.label.en)}
              </p>
            </div>
          ))}
        </div>

        {progress < 0.05 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-center gap-1.5 text-xs font-semibold text-wit-gray">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
            {t("Sigue bajando", "Keep scrolling")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
