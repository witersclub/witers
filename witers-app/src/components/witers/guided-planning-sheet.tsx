import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  Video,
  X,
} from "lucide-react";

import { WMark } from "./brand";
import { useLanguage } from "../../lib/i18n";

type CalendarFormat = "imagen" | "video" | "carrusel";
type CalendarEntryDraft = {
  date: string;
  slot?: number;
  format: CalendarFormat;
  title: string;
  brief: string;
  slides?: { title: string; brief: string }[];
};

type Objective = "messages" | "sales" | "community" | "brand" | "other";
type Frequency = "3" | "4" | "5" | "custom";
type FormatChoice = CalendarFormat | "recommended";

const OBJECTIVES: Array<{
  id: Objective;
  label: string;
  description: string;
  Icon: typeof MessageCircle;
}> = [
  {
    id: "messages",
    label: "Más mensajes",
    description: "Atrae más conversaciones.",
    Icon: MessageCircle,
  },
  {
    id: "sales",
    label: "Más ventas",
    description: "Impulsa tus productos o servicios.",
    Icon: ShoppingBag,
  },
  { id: "community", label: "Crecer comunidad", description: "Aumenta tu audiencia.", Icon: Users },
  { id: "brand", label: "Posicionar marca", description: "Fortalece tu presencia.", Icon: Star },
  {
    id: "other",
    label: "Otro objetivo",
    description: "Personalizar objetivo.",
    Icon: MoreHorizontal,
  },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function plannedDates(year: number, month: number, frequency: Frequency, customCount: number) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const allowedWeekdays =
    frequency === "3" ? [1, 3, 5] : frequency === "4" ? [1, 2, 4, 6] : [1, 2, 3, 4, 5];
  const all = Array.from(
    { length: days },
    (_, index) => new Date(Date.UTC(year, month - 1, index + 1)),
  );
  if (frequency !== "custom")
    return all.filter((day) => allowedWeekdays.includes(day.getUTCDay())).map(iso);
  const amount = Math.max(1, Math.min(days, customCount || 1));
  if (amount === days) return all.map(iso);
  return Array.from({ length: amount }, (_, index) =>
    iso(all[Math.round((index * (days - 1)) / Math.max(1, amount - 1))]),
  );
}

function objectiveCopy(objective: Objective, custom: string) {
  if (objective === "messages") return "Más mensajes";
  if (objective === "sales") return "Más ventas";
  if (objective === "community") return "Crecer comunidad";
  if (objective === "brand") return "Posicionar marca";
  return custom.trim() || "Objetivo personalizado";
}

function formatCopy(formats: FormatChoice[]) {
  if (formats.includes("recommended")) return "Mezcla recomendada por WITERS";
  return formats
    .map((format) =>
      format === "video" ? "Reels" : format === "carrusel" ? "Carruseles" : "Imágenes",
    )
    .join(" · ");
}

export function GuidedPlanningSheet({
  targetYear,
  targetMonth,
  monthLabel,
  onClose,
  onCreated,
}: {
  targetYear: number;
  targetMonth: number;
  monthLabel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [otherObjective, setOtherObjective] = useState("");
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [customCount, setCustomCount] = useState(12);
  const [formats, setFormats] = useState<FormatChoice[]>(["recommended"]);
  const [specialInfo, setSpecialInfo] = useState("");
  const [state, setState] = useState<"form" | "generating" | "success" | "error">("form");
  const [entries, setEntries] = useState<CalendarEntryDraft[]>([]);
  const dates = useMemo(
    () => (frequency ? plannedDates(targetYear, targetMonth, frequency, customCount) : []),
    [customCount, frequency, targetMonth, targetYear],
  );
  const canContinue =
    step === 0
      ? Boolean(objective && (objective !== "other" || otherObjective.trim()))
      : step === 1
        ? Boolean(frequency)
        : step === 2
          ? formats.length > 0
          : true;
  const formatTotals = entries.reduce<Record<CalendarFormat, number>>(
    (totals, entry) => {
      totals[entry.format] += 1;
      return totals;
    },
    { imagen: 0, video: 0, carrusel: 0 },
  );

  function toggleFormat(format: FormatChoice) {
    if (format === "recommended") {
      setFormats(["recommended"]);
      return;
    }
    setFormats((current) => {
      const withoutRecommended = current.filter((item) => item !== "recommended");
      return withoutRecommended.includes(format)
        ? withoutRecommended.filter((item) => item !== format)
        : [...withoutRecommended, format];
    });
  }

  async function generate() {
    if (!objective || !frequency || !dates.length) return;
    setState("generating");
    const chosenFormats = formats.includes("recommended")
      ? "una mezcla recomendada de reels, carruseles e imágenes"
      : formatCopy(formats);
    const prompt = [
      `Genera el plan de contenido para ${monthLabel}.`,
      `Objetivo principal: ${objectiveCopy(objective, otherObjective)}.`,
      `Frecuencia: ${dates.length} piezas distribuidas durante el mes.`,
      `Formatos prioritarios: ${chosenFormats}.`,
      specialInfo.trim()
        ? `Información importante: ${specialInfo.trim()}.`
        : "No hay información especial adicional.",
      `Crea exactamente una pieza para cada una de estas fechas: ${dates.join(", ")}.`,
      "No hagas preguntas ni devuelvas conversación: entrega directamente la planificación usando submit_content_calendar.",
    ].join("\n");
    try {
      const res = await fetch("/api/wit/calendar-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          year: targetYear,
          month: targetMonth,
          expectedEntries: dates.length,
          plannedDates: dates,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        kind?: string;
        entries?: CalendarEntryDraft[];
      };
      if (!data.ok || data.kind !== "done" || !data.entries?.length) throw new Error("generation");
      const save = await fetch("/api/calendar-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: data.entries }),
      });
      const saved = (await save.json()) as { ok: boolean };
      if (!saved.ok) throw new Error("save");
      setEntries(data.entries);
      setState("success");
      onCreated();
    } catch {
      setState("error");
    }
  }

  const content = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-wit-ink/25 p-0 backdrop-blur-[2px] md:items-center md:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-planning-title"
        className="relative flex h-[82dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_-12px_48px_rgba(10,30,80,0.16)] motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-[400ms] md:h-auto md:max-h-[85dvh] md:min-h-[620px] md:rounded-[30px]"
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-wit-ink/15 md:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Cerrar", "Close")}
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-wit-gray transition hover:bg-wit-mist/70 hover:text-wit-ink"
        >
          <X className="h-5 w-5" />
        </button>
        <header className="px-6 pb-4 pt-6 md:px-8">
          <div
            className="flex items-center gap-2 pr-10"
            aria-label={t(
              `Paso ${Math.min(step + 1, 5)} de 5`,
              `Step ${Math.min(step + 1, 5)} of 5`,
            )}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${index <= step ? "bg-wit-blue" : "bg-wit-ink/12"}`}
              />
            ))}
            <span className="ml-1 h-px flex-1 bg-wit-ink/8" />
            <span className="text-xs font-bold text-wit-gray">{Math.min(step + 1, 5)}/5</span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 md:px-8">
          {state === "generating" ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <span className="grid h-20 w-20 place-items-center rounded-[28px] bg-wit-blue/[0.08] text-wit-blue">
                <WMark size={46} />
              </span>
              <h2 id="guided-planning-title" className="mt-6 text-2xl font-extrabold text-wit-ink">
                {t("Preparando tu planificación", "Preparing your plan")}
              </h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-wit-gray">
                {t(
                  "WITERS está armando un plan personalizado para ti.",
                  "WITERS is building a personalized plan for you.",
                )}
              </p>
              <div className="mt-7 h-2 w-56 overflow-hidden rounded-full bg-wit-mist">
                <span className="block h-full w-2/3 animate-pulse rounded-full bg-wit-blue" />
              </div>
              <p className="mt-4 text-xs font-semibold text-wit-blue">
                {t("Organizando las fechas y formatos…", "Organizing dates and formats…")}
              </p>
            </div>
          ) : state === "success" ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-10 w-10" strokeWidth={2.8} />
              </span>
              <h2 id="guided-planning-title" className="mt-5 text-2xl font-extrabold text-wit-ink">
                {t("¡Tu plan está listo!", "Your plan is ready!")}
              </h2>
              <p className="mt-2 text-sm text-wit-gray">
                {t(
                  `Hemos creado ${entries.length} piezas para ${monthLabel}.`,
                  `We've created ${entries.length} pieces for ${monthLabel}.`,
                )}
              </p>
              <div className="mt-7 grid w-full grid-cols-3 divide-x divide-wit-ink/8 rounded-2xl border border-wit-ink/6 bg-wit-mist/25 py-4">
                {[
                  ["video", "Reels"],
                  ["carrusel", "Carruseles"],
                  ["imagen", "Imágenes"],
                ].map(([format, label]) => (
                  <div key={format}>
                    <strong className="block text-xl font-extrabold text-wit-ink">
                      {formatTotals[format as CalendarFormat]}
                    </strong>
                    <span className="text-[11px] font-semibold text-wit-gray">{label}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-wit-blue px-5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(0,71,255,0.2)]"
              >
                {t("Ver planificación", "View plan")} <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setState("form")}
                className="mt-3 min-h-11 text-sm font-bold text-wit-blue"
              >
                {t("Editar respuestas", "Edit answers")}
              </button>
            </div>
          ) : state === "error" ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-600">
                <X className="h-8 w-8" />
              </span>
              <h2 id="guided-planning-title" className="mt-5 text-xl font-extrabold text-wit-ink">
                {t("No pudimos terminar tu planificación.", "We couldn't finish your plan.")}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-wit-gray">
                {t(
                  "Tus respuestas se conservaron. Intenta de nuevo cuando estés listo.",
                  "Your answers were saved. Try again when you're ready.",
                )}
              </p>
              <button
                type="button"
                onClick={generate}
                className="mt-7 min-h-14 w-full rounded-[18px] bg-wit-blue text-sm font-extrabold text-white"
              >
                {t("Intentar nuevamente", "Try again")}
              </button>
            </div>
          ) : step === 0 ? (
            <div>
              <h2
                id="guided-planning-title"
                className="text-2xl font-extrabold tracking-tight text-wit-ink"
              >
                {t("¿Qué quieres lograr este mes?", "What do you want to achieve this month?")}
              </h2>
              <p className="mt-2 text-sm text-wit-gray">
                {t(
                  "Elige el objetivo principal de tu contenido.",
                  "Choose your content's main objective.",
                )}
              </p>
              <div className="mt-6 space-y-2.5">
                {OBJECTIVES.map(({ id, label, description, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setObjective(id)}
                    className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${objective === id ? "border-wit-blue bg-wit-blue/[0.05] shadow-[0_4px_14px_rgba(0,71,255,0.08)]" : "border-wit-ink/8 bg-white hover:border-wit-blue/30"}`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-xl ${objective === id ? "bg-wit-blue text-white" : "bg-wit-mist/70 text-wit-blue"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <strong className="block text-sm text-wit-ink">{t(label, label)}</strong>
                      <small className="mt-0.5 block text-xs text-wit-gray">
                        {t(description, description)}
                      </small>
                    </span>
                    {objective === id ? <Check className="ml-auto h-5 w-5 text-wit-blue" /> : null}
                  </button>
                ))}
              </div>
              {objective === "other" ? (
                <input
                  value={otherObjective}
                  onChange={(event) => setOtherObjective(event.target.value)}
                  placeholder={t("Describe tu objetivo", "Describe your objective")}
                  className="mt-3 min-h-12 w-full rounded-xl border border-wit-ink/12 px-4 text-sm outline-none focus:border-wit-blue"
                />
              ) : null}
            </div>
          ) : step === 1 ? (
            <div>
              <h2
                id="guided-planning-title"
                className="text-2xl font-extrabold tracking-tight text-wit-ink"
              >
                {t("¿Con qué frecuencia quieres publicar?", "How often do you want to post?")}
              </h2>
              <p className="mt-2 text-sm text-wit-gray">
                {t(
                  "Elegiremos las fechas reales para este mes.",
                  "We'll choose real dates for this month.",
                )}
              </p>
              <div className="mt-6 space-y-2.5">
                {(["3", "4", "5", "custom"] as Frequency[]).map((value) => {
                  const count = plannedDates(targetYear, targetMonth, value, customCount).length;
                  const label =
                    value === "custom"
                      ? t("Personalizar", "Customize")
                      : t(`${value} veces por semana`, `${value} times per week`);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFrequency(value)}
                      className={`flex min-h-[64px] w-full items-center justify-between rounded-2xl border px-4 text-left ${frequency === value ? "border-wit-blue bg-wit-blue/[0.05]" : "border-wit-ink/8"}`}
                    >
                      <span>
                        <strong className="block text-sm text-wit-ink">{label}</strong>
                        <small className="text-xs text-wit-gray">
                          {value === "custom"
                            ? t("Elegir cantidad", "Choose amount")
                            : t(`${count} piezas este mes`, `${count} pieces this month`)}
                        </small>
                      </span>
                      {frequency === value ? <Check className="h-5 w-5 text-wit-blue" /> : null}
                    </button>
                  );
                })}
              </div>
              {frequency === "custom" ? (
                <label className="mt-4 block text-sm font-bold text-wit-ink">
                  {t("Cantidad de piezas", "Number of pieces")}
                  <input
                    type="number"
                    min="1"
                    max={new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()}
                    value={customCount}
                    onChange={(event) => setCustomCount(Number(event.target.value))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-wit-ink/12 px-4 outline-none focus:border-wit-blue"
                  />
                </label>
              ) : null}
            </div>
          ) : step === 2 ? (
            <div>
              <h2
                id="guided-planning-title"
                className="text-2xl font-extrabold tracking-tight text-wit-ink"
              >
                {t("¿Qué formatos quieres priorizar?", "Which formats do you want to prioritize?")}
              </h2>
              <p className="mt-2 text-sm text-wit-gray">
                {t("Puedes elegir más de uno.", "You can choose more than one.")}
              </p>
              <div className="mt-6 space-y-2.5">
                {(
                  [
                    { id: "video", label: "Reels", description: "Videos cortos", Icon: Video },
                    {
                      id: "carrusel",
                      label: "Carruseles",
                      description: "Contenido educativo",
                      Icon: CalendarDays,
                    },
                    {
                      id: "imagen",
                      label: "Imágenes",
                      description: "Publicaciones estáticas",
                      Icon: ImageIcon,
                    },
                    {
                      id: "recommended",
                      label: "Mezcla recomendada",
                      description: "Deja que WITERS decida",
                      Icon: Sparkles,
                    },
                  ] as Array<{
                    id: FormatChoice;
                    label: string;
                    description: string;
                    Icon: typeof Video;
                  }>
                ).map(({ id, label, description, Icon }) => {
                  const active = formats.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => toggleFormat(id)}
                      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border p-3 text-left ${active ? "border-wit-blue bg-wit-blue/[0.05]" : "border-wit-ink/8"}`}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-wit-mist/70 text-wit-blue">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <strong className="block text-sm text-wit-ink">{label}</strong>
                        <small className="text-xs text-wit-gray">{description}</small>
                      </span>
                      {active ? <Check className="ml-auto h-5 w-5 text-wit-blue" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : step === 3 ? (
            <div>
              <h2
                id="guided-planning-title"
                className="text-2xl font-extrabold tracking-tight text-wit-ink"
              >
                {t("¿Hay algo importante este mes?", "Is there anything important this month?")}
              </h2>
              <p className="mt-2 text-sm text-wit-gray">
                {t(
                  "Cuéntanos sobre promociones, lanzamientos, fechas especiales o temas clave.",
                  "Tell us about promotions, launches, special dates, or key topics.",
                )}
              </p>
              <textarea
                value={specialInfo}
                onChange={(event) => setSpecialInfo(event.target.value)}
                maxLength={1000}
                rows={6}
                placeholder={t(
                  "Ej. Lanzamiento de nueva colección, promoción del 15 al 20, evento especial…",
                  "E.g. New collection launch, promotion from the 15th to the 20th, special event…",
                )}
                className="mt-6 w-full resize-none rounded-2xl border border-wit-ink/10 bg-wit-mist/20 px-4 py-3 text-sm outline-none focus:border-wit-blue"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {["Promoción", "Lanzamiento", "Evento especial", "Fecha importante"].map((chip) => (
                  <button
                    type="button"
                    key={chip}
                    onClick={() =>
                      setSpecialInfo((value) =>
                        value ? `${value}${value.endsWith(" ") ? "" : " "}${chip}` : chip,
                      )
                    }
                    className="min-h-10 rounded-full bg-wit-blue/[0.06] px-3 text-xs font-bold text-wit-blue"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-wit-blue/[0.08] text-wit-blue">
                <Sparkles className="h-6 w-6" />
              </span>
              <h2
                id="guided-planning-title"
                className="mt-5 text-2xl font-extrabold tracking-tight text-wit-ink"
              >
                {t("¿Listo para generar tu plan?", "Ready to generate your plan?")}
              </h2>
              <p className="mt-2 text-sm text-wit-gray">
                {t(
                  "Revisa tus decisiones antes de crear la planificación.",
                  "Review your choices before creating the plan.",
                )}
              </p>
              <dl className="mt-6 divide-y divide-wit-ink/7 overflow-hidden rounded-2xl border border-wit-ink/7 bg-wit-mist/20">
                {[
                  ["Objetivo", objectiveCopy(objective!, otherObjective), 0],
                  ["Frecuencia", `${dates.length} piezas`, 1],
                  ["Formatos", formatCopy(formats), 2],
                  ["Información especial", specialInfo || "Sin información adicional", 3],
                ].map(([label, value, edit]) => (
                  <div key={String(label)} className="flex items-center gap-3 px-4 py-3">
                    <dt className="w-28 text-xs font-bold text-wit-gray">{label}</dt>
                    <dd className="min-w-0 flex-1 truncate text-sm font-bold text-wit-ink">
                      {value}
                    </dd>
                    <button
                      type="button"
                      onClick={() => setStep(Number(edit))}
                      className="text-xs font-bold text-wit-blue"
                    >
                      {t("Editar", "Edit")}
                    </button>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        {state === "form" ? (
          <footer className="flex shrink-0 gap-3 border-t border-wit-ink/7 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:px-8 md:pb-5">
            <button
              type="button"
              onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] border border-wit-ink/10 text-wit-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => (step === 4 ? void generate() : setStep((current) => current + 1))}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-[18px] bg-wit-blue px-5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(0,71,255,0.18)] disabled:opacity-35"
            >
              {step === 4 ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("Generar mi plan", "Generate my plan")}
                </>
              ) : (
                <>
                  {t("Continuar", "Continue")}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(content, document.body);
}
