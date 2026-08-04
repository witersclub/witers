// Three faithful mini-replicas of the real client panel — Inicio, Mi marca,
// and a campaign's detail view — shown inside iPhone frames on the public
// homepage, before anyone signs in. Earlier versions of this component were
// loose approximations (icon grids, invented layouts); this one reuses the
// exact classNames, component pieces, and copy the real authenticated
// screens use (see panel.tsx's Inicio block, BrandShowcaseLogoCard/
// BrandShowcaseColorsCard, and CampaignAdDetailModal) so it reads as an
// actual screenshot, not a stylized stand-in. Data is a single fictional
// example client ("Boutique Alma") reused across all three screens for a
// consistent story — never a real client's numbers or logo.
import type { ReactNode } from "react";
import {
  BookOpen,
  Calendar as CalendarIcon,
  Eye,
  FileDown,
  GalleryHorizontal,
  Home,
  Image as ImageIcon,
  type LucideIcon,
  Megaphone,
  Rocket,
  Target,
  User,
  Video as VideoIcon,
  X,
} from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { WMark } from "./brand";

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-[270px] rounded-[2.4rem] border-[8px] border-wit-ink bg-wit-ink shadow-[0_35px_80px_rgba(5,13,40,0.3)] sm:w-[288px]">
      <div className="relative h-[560px] overflow-hidden rounded-[1.7rem] bg-white sm:h-[590px]">
        <div className="absolute left-1/2 top-0 z-30 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-wit-ink" />
        {children}
      </div>
    </div>
  );
}

// Same two-glass-pills-plus-orb shape as the real PanelBottomNav
// (panel.tsx), reusing the actual .wit-glass and .wit-orb CSS instead of
// approximating them — the whole point of this rebuild was to stop
// inventing a look-alike and just show the real one, scaled down.
function MiniBottomNav({ active }: { active: "inicio" | "marca" }) {
  return (
    <div className="absolute inset-x-2.5 bottom-2.5 z-20 flex items-center gap-1.5">
      <div className="wit-glass flex flex-1 items-center justify-around rounded-full px-1 py-1.5">
        <MiniNavIcon icon={Home} isActive={active === "inicio"} />
        <MiniNavIcon icon={BookOpen} isActive={active === "marca"} />
      </div>
      <span className="wit-orb flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <span style={{ filter: "brightness(0) invert(1)" }}>
          <WMark size={15} />
        </span>
      </span>
      <div className="wit-glass flex flex-1 items-center justify-around rounded-full px-1 py-1.5">
        <MiniNavIcon icon={Megaphone} isActive={false} />
        <MiniNavIcon icon={User} isActive={false} />
      </div>
    </div>
  );
}

function MiniNavIcon({ icon: Icon, isActive }: { icon: LucideIcon; isActive: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-lg ${isActive ? "bg-wit-blue/10" : ""}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${isActive ? "text-wit-blue" : "text-wit-gray"}`}
        strokeWidth={2.2}
      />
    </span>
  );
}

// Scaled-down QuotaRing (panel.tsx) — same SVG ring construction, smaller
// radius/stroke, static percentages since this is a fixed example, not
// live data.
function MiniQuotaRing({
  icon: Icon,
  colorHex,
  pct,
  label,
}: {
  icon: LucideIcon;
  colorHex: string;
  pct: number;
  label: string;
}) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="#E4E9F7" strokeWidth="3.5" />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={colorHex}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <Icon className="h-3.5 w-3.5" style={{ color: colorHex }} strokeWidth={2.2} />
      </div>
      <span className="text-center text-[6.5px] font-semibold leading-none text-wit-gray">
        {label}
      </span>
    </div>
  );
}

function MiniResultStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className="h-3.5 w-3.5 text-wit-blue" strokeWidth={1.9} />
      <span className="text-xs font-extrabold leading-none text-wit-ink">{value}</span>
      <span className="text-[6.5px] leading-tight text-wit-gray">{label}</span>
    </div>
  );
}

function MiniAdStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[44px] shrink-0 rounded-lg bg-wit-ice/60 px-1.5 py-1">
      <p className="text-[6px] font-bold uppercase leading-tight tracking-wide text-wit-gray">
        {label}
      </p>
      <p className="text-[9px] font-bold text-wit-ink">{value}</p>
    </div>
  );
}

// Mirrors panel.tsx's real mobile Inicio block: greeting, "Mis solicitudes"
// strip (real pieces sit at their own aspect ratio, not force-cropped),
// "Tu cupo este mes" quota card, and the "Resultados de campañas" card —
// same order, same wit-glass treatment, same copy.
function InicioScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col pt-8">
      <div className="flex-1 space-y-4 overflow-hidden px-4 pb-16">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-wit-ink">
            {t("Hola,", "Hi,")} <span className="text-wit-blue">María</span>
          </p>
          <p className="mt-1 text-[9.5px] leading-snug text-wit-gray">
            {t(
              "Pide creatividades y da seguimiento a cada solicitud desde aquí.",
              "Request creatives and track every request from here.",
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-wit-ink">{t("Mis solicitudes", "My requests")}</p>
          <div className="mt-2 flex gap-2">
            <div
              className="h-20 shrink-0 overflow-hidden rounded-xl border border-wit-ink/10 shadow-sm"
              style={{
                aspectRatio: "3 / 4",
                background: "linear-gradient(135deg,#C97B84,#8a4f57)",
              }}
            />
            <div
              className="h-20 shrink-0 overflow-hidden rounded-xl border border-wit-ink/10 shadow-sm"
              style={{
                aspectRatio: "1 / 1",
                background: "linear-gradient(135deg,#B08D57,#6e5730)",
              }}
            />
            <div
              className="h-20 shrink-0 overflow-hidden rounded-xl border border-wit-ink/10 shadow-sm"
              style={{
                aspectRatio: "9 / 16",
                background: "linear-gradient(135deg,#2B2320,#544738)",
              }}
            />
          </div>
        </div>

        <div className="wit-glass rounded-2xl px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[7.5px] font-bold uppercase tracking-wide text-wit-gray">
              {t("Tu cupo este mes", "Your quota this month")}
            </p>
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-bold text-emerald-700">
              {t("Grow activa", "Grow active")}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-3">
            <MiniQuotaRing
              icon={ImageIcon}
              colorHex="#0047ff"
              pct={0.65}
              label={t("Imágenes", "Images")}
            />
            <MiniQuotaRing
              icon={VideoIcon}
              colorHex="#ff3fb0"
              pct={0.4}
              label={t("Video", "Video")}
            />
            <MiniQuotaRing
              icon={GalleryHorizontal}
              colorHex="#10b981"
              pct={0.8}
              label={t("Carrusel", "Carousel")}
            />
          </div>
        </div>

        <div className="wit-glass rounded-2xl p-3.5">
          <p className="text-xs font-bold text-wit-ink">
            {t("Resultados de campañas", "Campaign results")}
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-1">
            <MiniResultStat
              icon={Rocket}
              value="2"
              label={t("campañas lanzadas", "campaigns launched")}
            />
            <MiniResultStat
              icon={Eye}
              value="6,539"
              label={t("personas alcanzadas", "people reached")}
            />
            <MiniResultStat
              icon={Target}
              value="76"
              label={t("mensajes recibidos", "messages received")}
            />
          </div>
        </div>
      </div>
      <MiniBottomNav active="inicio" />
    </div>
  );
}

// Mirrors "Mi marca" (BrandShowcaseLogoCard + BrandShowcaseColorsCard,
// panel.tsx) — same wit-glass aspect-[4/3] logo card and colors grid, with
// the same swipe-carousel dot indicator underneath the logo card the real
// mobile view shows. The logo itself is a plain placeholder mark (never a
// real or invented brand's actual logo file) for the same fictional
// "Boutique Alma" example used across all three screens.
function MiMarcaScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col pt-8">
      <div className="flex-1 space-y-3 overflow-hidden px-4 pb-16">
        <p className="text-lg font-extrabold tracking-tight text-wit-ink">
          {t("Mi marca", "My brand")}
        </p>

        <div className="wit-glass flex aspect-[4/3] flex-col items-center justify-center gap-2.5 rounded-3xl p-5">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-[0_12px_28px_rgba(201,123,132,0.4)]"
            style={{ background: "linear-gradient(135deg,#C97B84,#8a4f57)" }}
          >
            A
          </span>
          <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-wit-gray">
            {t("Logotipo", "Logo")}
          </p>
        </div>

        <div className="flex justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-wit-ink/15" />
          <span className="h-1.5 w-4 rounded-full bg-wit-blue" />
          <span className="h-1.5 w-1.5 rounded-full bg-wit-ink/15" />
          <span className="h-1.5 w-1.5 rounded-full bg-wit-ink/15" />
        </div>

        <div className="wit-glass rounded-2xl p-3.5">
          <div className="grid grid-cols-4 gap-1.5">
            {["#C97B84", "#2B2320", "#F3E7DA", "#B08D57"].map((c) => (
              <div key={c} className="aspect-square rounded-lg" style={{ background: c }} />
            ))}
          </div>
          <p className="mt-2.5 text-[7px] font-bold uppercase tracking-[0.18em] text-wit-gray">
            {t("Colores de marca", "Brand colors")}
          </p>
        </div>
      </div>
      <MiniBottomNav active="marca" />
    </div>
  );
}

// Mirrors CampaignAdDetailModal (campaign-ad-detail-modal.tsx) — same
// header (title + campaign name + close), same date-range pill + "Hacer
// reporte" button, same per-ad card shape with status badge and stat
// pills. Rendered as a plain full screen inside the phone rather than a
// backdrop-blurred overlay — the modal chrome doesn't read at this scale,
// the content is the part worth showing.
function CampaignDetailScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-white pt-8">
      <div className="flex-1 overflow-hidden px-4 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-wit-ink">
              {t("Anuncios de la campaña", "Campaign ads")}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-wit-gray">
              {t("Boutique Alma — Rebajas", "Alma Boutique — Sale")}
            </p>
          </div>
          <X className="h-4 w-4 shrink-0 text-wit-gray" strokeWidth={2.4} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-wit-ink/10 px-2.5 py-1.5 text-[9px] font-bold text-wit-ink">
            <CalendarIcon className="h-2.5 w-2.5" strokeWidth={2.2} />
            {t("Últimos 7 días", "Last 7 days")}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-wit-blue px-2.5 py-1.5 text-[9px] font-bold text-white">
            <FileDown className="h-2.5 w-2.5" strokeWidth={2.2} />
            {t("Hacer reporte", "Generate report")}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-wit-ink/10 p-2.5">
            <div className="flex items-center gap-2">
              <div
                className="h-9 w-9 shrink-0 rounded-lg"
                style={{ background: "linear-gradient(135deg,#C97B84,#2B2320)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold text-wit-ink">
                  {t("Anuncio — Vestidos nuevos", "Ad — New dresses")}
                </p>
                <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-bold text-emerald-700">
                  {t("Activa", "Active")}
                </span>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-hidden">
              <MiniAdStat label={t("Gastado", "Spent")} value="$2,140" />
              <MiniAdStat label={t("Alcance", "Reach")} value="6,320" />
              <MiniAdStat label={t("Result.", "Results")} value="41" />
            </div>
          </div>

          <div className="rounded-2xl border border-wit-ink/10 p-2.5 opacity-60">
            <div className="flex items-center gap-2">
              <div
                className="h-9 w-9 shrink-0 rounded-lg"
                style={{ background: "linear-gradient(135deg,#B08D57,#2B2320)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold text-wit-ink">
                  {t("Anuncio — Accesorios", "Ad — Accessories")}
                </p>
                <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[7px] font-bold text-amber-700">
                  {t("Pausada", "Paused")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PanelPreviewShowcase() {
  const { t } = useLanguage();
  const screens: { key: string; label: string; node: ReactNode }[] = [
    { key: "inicio", label: t("Inicio", "Home"), node: <InicioScreen /> },
    { key: "marca", label: t("Mi marca", "My brand"), node: <MiMarcaScreen /> },
    {
      key: "campana",
      label: t("Detalle de campaña", "Campaign detail"),
      node: <CampaignDetailScreen />,
    },
  ];
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-12">
      {screens.map((s) => (
        <div key={s.key} className="flex flex-col items-center gap-3">
          <PhoneFrame>{s.node}</PhoneFrame>
          <p className="text-sm font-bold text-wit-ink">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
