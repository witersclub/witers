// Two iPhone mockups, facing each other, showing what the client's own
// panel actually looks like — the "Creatividad" gallery on one side, a
// campaign's live results on the other. Built with the site's own design
// system and example data (never a real client's), same reasoning as
// MetaAdsDashboardCard: a real screenshot would show someone's actual
// numbers, go stale the moment the panel's design changes, and never look
// as crisp on every screen size as a component does.
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { useLanguage } from "../../lib/i18n";

function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`[perspective:1200px] ${className}`}>
      <div className="w-[248px] rounded-[2.4rem] border-[7px] border-wit-ink bg-wit-ink shadow-[0_45px_90px_rgba(5,13,40,0.35)] transition-transform duration-500 hover:[transform:rotateY(0deg)_rotateX(0deg)] sm:w-[264px]">
        <div className="relative h-[500px] overflow-hidden rounded-[1.8rem] bg-white sm:h-[530px]">
          <div className="absolute left-1/2 top-0 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-wit-ink" />
          {children}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-wit-ice/70 px-2.5 py-2">
      <p className="text-[8px] font-bold uppercase leading-tight tracking-wide text-wit-gray">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-extrabold text-wit-ink">{value}</p>
    </div>
  );
}

const CREATIVE_EXAMPLES = [
  "/assets/brand-example-alma.webp",
  "/assets/brand-example-hygge.webp",
  "/assets/brand-example-fitzone.webp",
  "/assets/brand-example-belle.webp",
  "/assets/brand-example-lumina.webp",
  "/assets/brand-example-noa.webp",
];

function CreativityScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col pt-9">
      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">WITERS</p>
          <p className="text-base font-extrabold leading-tight text-wit-ink">
            {t("Creatividad", "Creative")}
          </p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wit-blue text-[10px] font-bold text-white">
          {CREATIVE_EXAMPLES.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        {CREATIVE_EXAMPLES.map((src, i) => (
          <div
            key={src}
            className="relative aspect-square overflow-hidden rounded-2xl border border-wit-ink/10 bg-wit-mist/40"
          >
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[8px] font-bold text-wit-ink shadow-sm">
                {t("Nueva", "New")}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignResultsScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-wit-ice/50 pt-9">
      <div className="px-4 pb-3 pt-2">
        <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">WITERS</p>
        <p className="text-base font-extrabold leading-tight text-wit-ink">
          {t("Campañas", "Campaigns")}
        </p>
      </div>
      <div className="space-y-3 px-4 pb-4">
        <div className="rounded-2xl bg-white p-3.5 shadow-[0_10px_30px_rgba(5,13,40,0.07)]">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-wit-ink">
              {t("Boutique Alma", "Alma Boutique")}
            </p>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
              {t("Activa", "Active")}
            </span>
          </div>
          <p className="mt-1 text-[9px] text-wit-gray">
            {t("Presupuesto: $150 MXN/día", "Budget: $150 MXN/day")}
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <StatPill label={t("Gastado", "Spent")} value="$4,280" />
            <StatPill label={t("Alcance", "Reach")} value="12,640" />
            <StatPill label={t("Resultados", "Results")} value="184" />
            <StatPill label={t("Costo/res.", "Cost/res.")} value="$23.26" />
          </div>
          <svg viewBox="0 0 200 40" className="mt-2.5 h-8 w-full" aria-hidden="true">
            <polyline
              fill="none"
              stroke="#0047FF"
              strokeOpacity="0.85"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,34 30,28 60,30 90,18 120,20 150,8 180,6 200,2"
            />
          </svg>
        </div>
        <div className="rounded-2xl bg-white/70 p-3.5 opacity-60 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-wit-ink">
              {t("Rebajas de invierno", "Winter sale")}
            </p>
            <span className="shrink-0 rounded-full bg-wit-mist/60 px-2 py-0.5 text-[9px] font-bold text-wit-gray">
              {t("Pausada", "Paused")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// The pairing used on the homepage: "de tus piezas" on the left, "a
// resultados medibles" on the right, an arrow tying the two together —
// mirrors the same "de la pieza a la campaña" story CampanasTeaser already
// tells, but as a direct look at the actual panel instead of a concept.
export function PanelPreviewShowcase() {
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-center sm:gap-0">
      <PhoneFrame className="[transform:rotateY(8deg)_rotateX(2deg)] sm:z-0 sm:mr-[-14px] sm:[transform:rotateY(16deg)_rotateX(3deg)]">
        <CreativityScreen />
      </PhoneFrame>
      <span className="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white shadow-[0_12px_30px_rgba(0,71,255,0.38)]">
        <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" strokeWidth={2.5} />
      </span>
      <PhoneFrame className="[transform:rotateY(-8deg)_rotateX(2deg)] sm:z-0 sm:ml-[-14px] sm:[transform:rotateY(-16deg)_rotateX(3deg)]">
        <CampaignResultsScreen />
      </PhoneFrame>
    </div>
  );
}
