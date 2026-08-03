import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";

import { Calendar as DateRangeCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "../../lib/i18n";

// The Campañas-tab-level counterpart to the date-range picker inside
// CampaignAdDetailModal — same UI, same presets, but filters the whole
// campaign list (and the "todas las campañas" report) instead of one
// campaign's ads. Pulled into its own file rather than shared with the
// modal's copy so panel.tsx (not lazy — the modal already is) can
// React.lazy() this one on its own: react-day-picker + date-fns are the
// same ~430KB regression that got the modal's copy extracted before.

export type CampaignRange = { since: string; until: string };

const CAMPAIGN_RANGE_PRESET_DAYS = [1, 3, 7, 15, 30, 60];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCampaignRangeLabel(range: CampaignRange | null, allTimeLabel: string): string {
  if (!range) return allTimeLabel;
  return `${format(new Date(`${range.since}T00:00:00`), "d MMM", { locale: es })} – ${format(new Date(`${range.until}T00:00:00`), "d MMM", { locale: es })}`;
}

export default function CampaignDateRangePicker({
  range,
  onChange,
}: {
  range: CampaignRange | null;
  onChange: (range: CampaignRange | null) => void;
}) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  // The calendar's in-progress selection, separate from `range` — dragging
  // a range takes two clicks (start, then end), so this only becomes the
  // real filter once "Aplicar" confirms it, instead of refetching after
  // the very first click.
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);

  function applyPreset(days: number) {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    onChange({ since: isoDate(since), until: isoDate(until) });
    setDraftRange(undefined);
    setPickerOpen(false);
  }

  function applyCustomRange() {
    if (!draftRange?.from) return;
    onChange({ since: isoDate(draftRange.from), until: isoDate(draftRange.to ?? draftRange.from) });
    setPickerOpen(false);
  }

  function clearRange() {
    onChange(null);
    setDraftRange(undefined);
    setPickerOpen(false);
  }

  const rangeLabel = formatCampaignRangeLabel(range, t("Todo el tiempo", "All time"));

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-wit-ink/10 bg-white px-3.5 py-2 text-xs font-bold text-wit-ink transition-colors hover:border-wit-blue/40 hover:text-wit-blue"
        >
          <CalendarIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
          {rangeLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-xs p-4 sm:w-auto sm:max-w-sm"
      >
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
  );
}
