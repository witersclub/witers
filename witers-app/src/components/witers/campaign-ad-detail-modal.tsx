import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, FileDown, Loader2, X } from "lucide-react";

import { Calendar as DateRangeCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "../../lib/i18n";
import { buildCampaignReportPdf, downloadPdf } from "../../lib/campaign-report-pdf";

// Pulled into its own file so panel.tsx can React.lazy() it — react-day-picker
// + date-fns added ~430KB to the main panel bundle when they were just
// top-level imports there, for a date-range picker almost nobody opens on
// any given visit. Splitting it out means that cost is only paid once a
// client actually clicks into a campaign's ad detail.

const CAMPAIGN_STATUS_LABEL: Record<string, { es: string; en: string; cls: string }> = {
  ACTIVE: { es: "Activa", en: "Active", cls: "bg-emerald-50 text-emerald-700" },
  PAUSED: { es: "Pausada", en: "Paused", cls: "bg-amber-50 text-amber-700" },
  DELETED: { es: "Eliminada", en: "Deleted", cls: "bg-red-50 text-red-600" },
  ARCHIVED: { es: "Archivada", en: "Archived", cls: "bg-wit-mist/60 text-wit-gray" },
};

// Always laid out in one scrollable horizontal row rather than a wrapping
// grid — min-w keeps a stat from getting squeezed unreadably narrow on a
// small screen instead of just wrapping. Duplicated from CampaignCard's copy
// in panel.tsx rather than shared/imported — small enough that the
// duplication is cheaper than wiring a cross-file export just for this.
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

type AdDetail = {
  id: string;
  name: string;
  status: string;
  previewImageUrl: string | null;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  results: string;
  costPerResult: string;
};

const CAMPAIGN_RANGE_PRESET_DAYS = [1, 3, 7, 15, 30, 60];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The per-ad drill-down behind a campaign card — same centered-modal pattern
// as ImagePacksModal. Fetched on open rather than upfront with the campaign
// list: it's a Meta call per ad, only worth paying for once someone actually
// wants the breakdown. The date-range picker below is scoped to this modal
// only — the campaign list and the Inicio impact badges intentionally stay
// all-time regardless of what's picked in here, per the client's call.
export default function CampaignAdDetailModal({
  campaign,
  companyName,
  onClose,
}: {
  campaign: { id: string; name: string | null };
  companyName: string | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  // null = "todo el tiempo" (the original, unfiltered behavior).
  const [range, setRange] = useState<{ since: string; until: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  // The calendar's in-progress selection, separate from `range` — dragging
  // a range takes two clicks (start, then end), so this only becomes the
  // real filter once "Aplicar" confirms it, instead of refetching after
  // the very first click.
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);

  const ads = useQuery({
    queryKey: ["campaign-ads", campaign.id, range?.since ?? null, range?.until ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ id: campaign.id });
      if (range) {
        params.set("since", range.since);
        params.set("until", range.until);
      }
      const res = await fetch(`/api/campaign-ads?${params.toString()}`, {
        credentials: "include",
      });
      return (await res.json()) as { ok: boolean; ads?: AdDetail[]; error?: string };
    },
  });

  function applyPreset(days: number) {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    setRange({ since: isoDate(since), until: isoDate(until) });
    setDraftRange(undefined);
    setPickerOpen(false);
  }

  function applyCustomRange() {
    if (!draftRange?.from) return;
    setRange({ since: isoDate(draftRange.from), until: isoDate(draftRange.to ?? draftRange.from) });
    setPickerOpen(false);
  }

  function clearRange() {
    setRange(null);
    setDraftRange(undefined);
    setPickerOpen(false);
  }

  const rangeLabel = range
    ? `${format(new Date(`${range.since}T00:00:00`), "d MMM", { locale: es })} – ${format(new Date(`${range.until}T00:00:00`), "d MMM", { locale: es })}`
    : t("Todo el tiempo", "All time");

  async function handleReport() {
    if (generatingReport || !ads.data?.ok) return;
    setGeneratingReport(true);
    try {
      const bytes = await buildCampaignReportPdf({
        companyName,
        campaignName: campaign.name ?? "",
        rangeLabel,
        ads: ads.data.ads ?? [],
      });
      const slug = (campaign.name ?? "campana")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      downloadPdf(bytes, `WITERS-Reporte-${slug || "campana"}.pdf`);
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wit-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-7 shadow-[0_30px_80px_rgba(5,13,40,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-wit-ink">
              {t("Anuncios de la campaña", "Campaign ads")}
            </p>
            <p className="mt-1 truncate text-sm text-wit-gray">
              {campaign.name ?? t("Campaña", "Campaign")}
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-wit-ink/10 px-3.5 py-2 text-xs font-bold text-wit-ink transition-colors hover:border-wit-blue/40 hover:text-wit-blue"
              >
                <CalendarIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                {rangeLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[calc(100vw-2rem)] max-w-xs p-4 sm:w-auto sm:max-w-sm"
            >
              {/* One month, not two side by side — a two-month calendar was
                  taller than the screen on mobile and forced the popover
                  wider than the viewport, cutting off the last preset
                  chips. A single compact box fits comfortably instead;
                  dragging across a month boundary still works fine, the
                  calendar just pages forward/back as usual. */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={clearRange}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors hover:bg-wit-mist/60 ${
                    range === null ? "bg-wit-blue/10 text-wit-blue" : "text-wit-ink"
                  }`}
                >
                  {t("Todo el tiempo", "All time")}
                </button>
                {CAMPAIGN_RANGE_PRESET_DAYS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => applyPreset(days)}
                    className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-wit-ink transition-colors hover:bg-wit-mist/60"
                  >
                    {t(`${days} día${days > 1 ? "s" : ""}`, `${days} day${days > 1 ? "s" : ""}`)}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-center">
                <DateRangeCalendar
                  mode="range"
                  numberOfMonths={1}
                  selected={draftRange}
                  onSelect={setDraftRange}
                  disabled={{ after: new Date() }}
                  locale={es}
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={applyCustomRange}
                  disabled={!draftRange?.from}
                  className="rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                >
                  {t("Aplicar", "Apply")}
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={handleReport}
            disabled={generatingReport || !ads.data?.ok}
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

        <div className="mt-6 space-y-3">
          {ads.isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-wit-ice/60" />
            ))
          ) : !ads.data?.ok ? (
            <p className="text-sm text-red-600">
              {t(
                `No pudimos leer los anuncios: ${ads.data?.error ?? "error"}`,
                `We couldn't read the ads: ${ads.data?.error ?? "error"}`,
              )}
            </p>
          ) : ads.data.ads && ads.data.ads.length > 0 ? (
            ads.data.ads.map((ad) => {
              const st = CAMPAIGN_STATUS_LABEL[ad.status] ?? {
                es: ad.status,
                en: ad.status,
                cls: "bg-wit-mist/60 text-wit-gray",
              };
              return (
                <div key={ad.id} className="rounded-2xl border border-wit-ink/10 p-4">
                  <div className="flex items-center gap-3">
                    {ad.previewImageUrl ? (
                      <img
                        src={ad.previewImageUrl}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-xl border border-wit-ink/10 object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-wit-ink">{ad.name}</p>
                      <span
                        className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}
                      >
                        {t(st.es, st.en)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    <CampaignStat
                      label={t("Gastado", "Spent")}
                      value={`$${Number(ad.spend).toLocaleString("es-MX")}`}
                    />
                    <CampaignStat
                      label={t("Alcance", "Reach")}
                      value={Number(ad.reach).toLocaleString("es-MX")}
                    />
                    <CampaignStat
                      label={t("Impr.", "Impr.")}
                      value={Number(ad.impressions).toLocaleString("es-MX")}
                    />
                    <CampaignStat
                      label={t("Resultados", "Results")}
                      value={Number(ad.results).toLocaleString("es-MX")}
                    />
                    <CampaignStat
                      label={t("Costo/res.", "Cost/result")}
                      value={`$${Number(ad.costPerResult).toLocaleString("es-MX")}`}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-wit-gray">
              {t("Esta campaña aún no tiene anuncios.", "This campaign has no ads yet.")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
