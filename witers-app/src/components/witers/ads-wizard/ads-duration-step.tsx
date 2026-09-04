import { useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useLanguage } from "../../../lib/i18n";

const PRESETS = [3, 7, 14];
const RECOMMENDED = 7;

export function AdsDurationStep({
  durationDays,
  onChange,
  dailyBudgetMxn,
}: {
  durationDays: number;
  onChange: (days: number) => void;
  dailyBudgetMxn: number;
}) {
  const { t, lang } = useLanguage();
  const [customMode, setCustomMode] = useState<"none" | "days" | "date">(
    PRESETS.includes(durationDays) ? "none" : "days",
  );
  // The campaign always starts the moment it's created — there's no
  // "schedule for later" in the backend (see meta-ads-create.server.ts,
  // start_time is always `now`). "Elegir fechas" is real in the sense
  // that it picks a genuine end date and derives durationDays from it,
  // it just can't move the start date — the label below says so.
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
  );
  const investment = dailyBudgetMxn * durationDays;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Duración", "Duration")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t(
          "¿Cuánto tiempo quieres mantener activa tu campaña?",
          "How long do you want to keep your campaign active?",
        )}
      </h2>

      <div className="mt-6 grid gap-2.5">
        {PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              setCustomMode("none");
              onChange(days);
            }}
            className={`relative flex min-h-13 items-center justify-between rounded-2xl border px-4 ${
              customMode === "none" && durationDays === days
                ? "border-wit-blue bg-wit-blue/[0.04]"
                : "border-wit-ink/8"
            }`}
          >
            <b className="text-sm text-wit-ink">
              {days} {t("días", "days")}
            </b>
            {days === RECOMMENDED ? (
              <span className="rounded-full bg-wit-blue/10 px-2 py-1 text-[10px] font-bold text-wit-blue">
                {t("Recomendado", "Recommended")}
              </span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomMode("days")}
          className={`flex min-h-13 items-center rounded-2xl border px-4 ${customMode === "days" ? "border-wit-blue bg-wit-blue/[0.04]" : "border-wit-ink/8"}`}
        >
          <b className="text-sm text-wit-ink">
            {t("Otra cantidad de días", "A different number of days")}
          </b>
        </button>
        <Popover
          onOpenChange={(open) => {
            if (open) setCustomMode("date");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex min-h-13 items-center gap-2 rounded-2xl border px-4 ${customMode === "date" ? "border-wit-blue bg-wit-blue/[0.04]" : "border-wit-ink/8"}`}
            >
              <CalendarIcon className="h-4 w-4 text-wit-gray" />
              <b className="text-sm text-wit-ink">
                {customMode === "date" && endDate
                  ? t(
                      `Hasta ${format(endDate, "d MMM", { locale: es })}`,
                      `Until ${format(endDate, "MMM d")}`,
                    )
                  : t("Elegir fecha", "Choose a date")}
              </b>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <DateCalendar
              mode="single"
              locale={lang === "es" ? es : undefined}
              selected={endDate}
              disabled={{ before: new Date(Date.now() + 24 * 60 * 60 * 1000) }}
              onSelect={(date) => {
                if (!date) return;
                setEndDate(date);
                const days = Math.max(1, differenceInCalendarDays(date, new Date()));
                onChange(days);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {customMode === "days" ? (
        <input
          type="number"
          min={1}
          max={90}
          value={durationDays}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-3 h-12 w-full rounded-xl border border-wit-ink/10 px-4 text-sm outline-none focus:border-wit-blue"
          aria-label={t("Número de días", "Number of days")}
          autoFocus
        />
      ) : null}
      {customMode === "date" ? (
        <p className="mt-2 text-xs text-wit-gray">
          {t(
            "La campaña empieza en cuanto la creas — esta fecha solo define cuándo termina.",
            "The campaign starts as soon as you create it — this date only sets when it ends.",
          )}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl bg-wit-mist/35 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-wit-gray">
            ${dailyBudgetMxn.toLocaleString()} × {durationDays} {t("días", "days")}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-sm font-bold text-wit-ink">
            {t("Inversión máxima estimada", "Estimated maximum investment")}
          </span>
          <b className="text-lg text-wit-blue">${investment.toLocaleString()} MXN</b>
        </div>
        <p className="mt-1 text-[11px] text-wit-gray">
          {t(
            "Meta puede gastar menos según el rendimiento.",
            "Meta may spend less depending on performance.",
          )}
        </p>
      </div>
    </div>
  );
}
