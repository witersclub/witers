// Client-facing "Planificación" — a monthly content calendar Wit fills in
// one conversation (see /api/wit/calendar-chat), which the client reviews
// and confirms before it's saved (see /api/calendar-entries), same
// "propose, then a review card the client explicitly confirms" shape as
// CarouselWizard in carousel-requests.tsx. Tapping a day's piece creates the
// real request in one click for all three formats — carrusel arrives with
// its 4 slides already structured by Wit at planning time, and video with
// no uploaded file (the guion becomes the AI-scenes note) — see
// /api/calendar-entries-request.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  GalleryHorizontal,
  Image as ImageIcon,
  RefreshCw,
  Video as VideoIcon,
  X,
} from "lucide-react";

import { WMark } from "./brand";
import { ChatBubble } from "./chat-intake";
import { ASPECT_OPTIONS, AspectRatioPicker } from "./lab-pickers";
import { MicButton } from "./mic-button";
import { useLanguage } from "../../lib/i18n";

// video no soporta 4:3/3:4 (ver el enum real en video-requests.ts) — se le
// muestra un subconjunto del mismo picker en vez de uno aparte.
const VIDEO_ASPECT_VALUES = new Set(["1:1", "16:9", "9:16"]);

type CalendarFormat = "imagen" | "video" | "carrusel";
type CalendarSlideDraft = { title: string; brief: string };
type CalendarEntryDraft = {
  date: string;
  format: CalendarFormat;
  title: string;
  brief: string;
  slides?: CalendarSlideDraft[]; // siempre 4, solo para format === "carrusel"
};
type CalendarEntry = CalendarEntryDraft & {
  id: string;
  requestId: string | null;
  status: "por_planear" | "en_diseno" | "lista";
};
type WitMessage = { role: "user" | "assistant"; content: string };

const FORMAT_ICON: Record<CalendarFormat, typeof ImageIcon> = {
  imagen: ImageIcon,
  video: VideoIcon,
  carrusel: GalleryHorizontal,
};

function formatLabel(format: CalendarFormat, t: (es: string, en: string) => string): string {
  if (format === "video") return t("Video", "Video");
  if (format === "carrusel") return t("Carrusel", "Carousel");
  return t("Imagen", "Image");
}

function statusMeta(
  status: CalendarEntry["status"],
  t: (es: string, en: string) => string,
): { label: string; badgeClass: string } {
  if (status === "lista")
    return { label: t("Lista", "Ready"), badgeClass: "bg-emerald-50 text-emerald-700" };
  if (status === "en_diseno")
    return { label: t("En diseño", "In design"), badgeClass: "bg-wit-blue/10 text-wit-blue" };
  return { label: t("Por planear", "Not requested"), badgeClass: "bg-wit-mist/50 text-wit-gray" };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string, t: (es: string, en: string) => string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(t("es-MX", "en-US"), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Mon-first 7-col grid, with leading/trailing days from the neighboring
// months so every row has 7 cells.
function buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = (first.getUTCDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = firstWeekday; i > 0; i--) {
    const d = new Date(Date.UTC(year, month - 1, 1 - i));
    cells.push({ date: isoDate(d), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: isoDate(new Date(Date.UTC(year, month - 1, day))), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(`${cells[cells.length - 1].date}T00:00:00Z`);
    last.setUTCDate(last.getUTCDate() + 1);
    cells.push({ date: isoDate(last), inMonth: false });
  }
  return cells;
}

/* ---------- wizard (Wit chat) ---------- */

function CalendarWizard({
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
  const [messages, setMessages] = useState<WitMessage[]>([
    {
      role: "assistant",
      content: t(
        `¡Hola! Vamos a planificar ${monthLabel}. ¿Con qué frecuencia quieres publicar y de qué temas?`,
        `Hi! Let's plan ${monthLabel}. How often do you want to post, and about what topics?`,
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [plan, setPlan] = useState<CalendarEntryDraft[] | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, plan]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function askWit(next: WitMessage[]) {
    setTyping(true);
    setChatError(null);
    try {
      const res = await fetch("/api/wit/calendar-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, year: targetYear, month: targetMonth }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: "message"; text: string }
        | { ok: true; kind: "done"; entries: CalendarEntryDraft[] }
        | { ok: false; error: string };
      if (!data.ok) {
        setChatError(
          t(
            "Wit no está disponible en este momento. Intenta de nuevo en un momento.",
            "Wit isn't available right now. Try again in a moment.",
          ),
        );
        return;
      }
      if (data.kind === "message") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else {
        setPlan(data.entries);
      }
    } catch {
      setChatError(
        t(
          "No pudimos hablar con Wit. Revisa tu conexión e intenta de nuevo.",
          "We couldn't reach Wit. Check your connection and try again.",
        ),
      );
    } finally {
      setTyping(false);
    }
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing || plan) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    void askWit(next);
  }

  async function confirmPlan() {
    if (!plan) return;
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch("/api/calendar-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: plan }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setSendError(
          t(
            "No pudimos guardar tu plan. Intenta de nuevo.",
            "We couldn't save your plan. Try again.",
          ),
        );
        return;
      }
      onCreated();
    } catch {
      setSendError(
        t(
          "No pudimos guardar tu plan. Intenta de nuevo.",
          "We couldn't save your plan. Try again.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden px-5 pb-4 pt-4">
      <div className="relative flex flex-col items-center gap-1.5 pb-1 pt-1">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Cerrar chat", "Close chat")}
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <div className="wit-float">
          <WMark size={26} />
        </div>
        <p className="text-sm font-medium text-wit-ink">
          {t(`Planificando ${monthLabel} con Wit`, `Planning ${monthLabel} with Wit`)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 py-4">
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} text={m.content} />
          ))}
          {typing ? <ChatBubble role="assistant" typingDots /> : null}
          {chatError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {chatError}
            </p>
          ) : null}
          {plan ? (
            <>
              <ChatBubble
                role="assistant"
                text={t(
                  "¡Listo! Revisa tu plan del mes antes de guardarlo:",
                  "Done! Review your month's plan before saving it:",
                )}
              />
              <div className="wit-glass rounded-2xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
                <div className="max-h-[40vh] space-y-2.5 overflow-y-auto">
                  {plan.map((entry, i) => {
                    const Icon = FORMAT_ICON[entry.format];
                    return (
                      <div key={i} className="rounded-xl bg-wit-mist/30 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-wit-blue">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {formatDayLabel(entry.date, t)} · {formatLabel(entry.format, t)}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-wit-ink">{entry.title}</p>
                        {entry.format === "carrusel" && entry.slides?.length ? (
                          <ol className="mt-1.5 space-y-1">
                            {entry.slides.map((slide, si) => (
                              <li key={si} className="text-xs text-wit-gray">
                                <span className="font-semibold text-wit-ink">
                                  {si + 1}. {slide.title}
                                </span>{" "}
                                — {slide.brief}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-0.5 text-xs text-wit-gray">{entry.brief}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={sending}
                  onClick={confirmPlan}
                  className="mt-4 w-full rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
                >
                  {sending
                    ? t("Guardando...", "Saving...")
                    : t("Confirmar plan del mes", "Confirm month's plan")}
                </button>
                {sendError ? <p className="mt-2 text-sm text-red-600">{sendError}</p> : null}
              </div>
            </>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {!plan ? (
        <div className="shrink-0 border-t border-wit-ink/10 pb-4 pt-3">
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
        </div>
      ) : null}
    </div>
  );
}

/* ---------- detail panel ---------- */

function EntryDetail({ entry }: { entry: CalendarEntry }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const Icon = FORMAT_ICON[entry.format];
  const meta = statusMeta(entry.status, t);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingFormat, setPickingFormat] = useState(false);

  // Reset the picker whenever the client switches to a different day —
  // otherwise it could stay open showing the wrong entry's options.
  useEffect(() => {
    setPickingFormat(false);
    setError(null);
  }, [entry.id]);

  async function requestNow(aspectRatio: string) {
    setError(null);
    setPickingFormat(false);
    setRequesting(true);
    try {
      const res = await fetch("/api/calendar-entries-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, aspectRatio }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(
          data.error === "sin_saldo"
            ? t(
                "Ya usaste todas tus solicitudes disponibles este mes.",
                "You've already used all your available requests this month.",
              )
            : data.error === "sin_membresia"
              ? t(
                  "Necesitas una membresía activa para pedir piezas.",
                  "You need an active membership to request pieces.",
                )
              : data.error === "faltan_laminas"
                ? t(
                    'Esta pieza se planificó antes de la última actualización y no tiene las 4 láminas listas. Usa "Replanear mes" para regenerarla.',
                    'This piece was planned before the latest update and is missing its 4 slides. Use "Re-plan month" to regenerate it.',
                  )
                : t(
                    "No pudimos enviar la solicitud. Intenta de nuevo.",
                    "We couldn't send the request. Try again.",
                  ),
        );
        return;
      }
      void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
    } catch {
      setError(
        t(
          "No pudimos enviar la solicitud. Intenta de nuevo.",
          "We couldn't send the request. Try again.",
        ),
      );
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="wit-glass rounded-3xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)] lg:sticky lg:top-5">
      <p className="text-xs font-bold uppercase tracking-wider text-wit-gray">
        {formatDayLabel(entry.date, t)}
      </p>

      <div className="mt-3 flex aspect-square items-center justify-center rounded-2xl border border-wit-ink/5 bg-gradient-to-br from-wit-mist/80 to-white/40">
        <Icon className="h-10 w-10 text-wit-blue/45" strokeWidth={1.6} />
      </div>

      <h3 className="mt-3.5 text-lg font-extrabold tracking-tight text-wit-ink">{entry.title}</h3>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-wit-mist/50 px-2.5 py-1 text-xs font-bold text-wit-gray">
          <Icon className="h-3 w-3" strokeWidth={2.4} />
          {formatLabel(entry.format, t)}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      {entry.format === "carrusel" && entry.slides?.length ? (
        <ol className="mt-3.5 space-y-1.5">
          {entry.slides.map((slide, si) => (
            <li key={si} className="text-sm leading-relaxed text-wit-gray">
              <span className="font-semibold text-wit-ink">
                {si + 1}. {slide.title}
              </span>{" "}
              — {slide.brief}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3.5 text-sm leading-relaxed text-wit-gray">{entry.brief}</p>
      )}

      {entry.status !== "por_planear" ? null : pickingFormat ? (
        <div className="mt-4">
          <p className="text-center text-xs font-bold text-wit-gray">
            {t("Elige el formato de esta pieza", "Choose this piece's format")}
          </p>
          <AspectRatioPicker
            options={
              entry.format === "video"
                ? ASPECT_OPTIONS.filter((opt) => VIDEO_ASPECT_VALUES.has(opt.value))
                : undefined
            }
            onPick={requestNow}
          />
          <button
            type="button"
            onClick={() => setPickingFormat(false)}
            className="mt-1 w-full text-center text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            {t("Cancelar", "Cancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={requesting}
          onClick={() => setPickingFormat(true)}
          className="wit-glow-button mt-4 w-full rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {requesting
            ? t("Enviando...", "Sending...")
            : t("Pedir esta pieza a Wit", "Request this piece from Wit")}
        </button>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

/* ---------- main panel ---------- */

export function PlanificacionPanel({ streakWeeks }: { streakWeeks: number }) {
  const { t } = useLanguage();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingReplan, setConfirmingReplan] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const qc = useQueryClient();

  const base = new Date();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const monthLabel = target.toLocaleDateString(t("es-MX", "en-US"), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const today = isoDate(base);

  const entriesQuery = useQuery({
    queryKey: ["calendar-entries", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar-entries?year=${year}&month=${month}`, {
        credentials: "include",
      });
      if (!res.ok) return { ok: false, entries: [] as CalendarEntry[] };
      return (await res.json()) as { ok: boolean; entries: CalendarEntry[] };
    },
  });
  const entries = entriesQuery.data?.entries ?? [];
  const entryByDate = new Map<string, CalendarEntry>();
  for (const e of entries) if (!entryByDate.has(e.date)) entryByDate.set(e.date, e);

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && entries.some((e) => e.id === prev)) return prev;
      // Default to the first not-yet-requested piece — the actual next
      // action — falling back to the first entry of the month.
      return (entries.find((e) => e.status === "por_planear") ?? entries[0]).id;
    });
    // Only re-run when the entry list itself changes — not on every
    // selectedId change, which would fight the user's own clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.id).join(",")]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const requestedCount = entries.filter((e) => e.status !== "por_planear").length;
  const pendingCount = entries.length - requestedCount;
  const progressPct = entries.length > 0 ? Math.round((requestedCount / entries.length) * 100) : 0;
  const grid = buildMonthGrid(year, month);

  async function replan() {
    setReplanning(true);
    try {
      await fetch(`/api/calendar-entries?year=${year}&month=${month}`, {
        method: "DELETE",
        credentials: "include",
      });
      await qc.invalidateQueries({ queryKey: ["calendar-entries", year, month] });
      setConfirmingReplan(false);
      setWizardOpen(true);
    } finally {
      setReplanning(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tighter text-wit-ink sm:text-4xl">
          <span className="flex items-center gap-2 text-wit-blue">
            <Calendar className="h-6 w-6" strokeWidth={2.2} />
            {monthLabel}
          </span>
          {streakWeeks > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              <Flame className="h-3.5 w-3.5" strokeWidth={2} />
              {t(
                `${streakWeeks} ${streakWeeks === 1 ? "semana seguida" : "semanas seguidas"}`,
                `${streakWeeks} ${streakWeeks === 1 ? "week in a row" : "weeks in a row"}`,
              )}
            </span>
          ) : null}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {entries.length > 0 && pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmingReplan(true)}
              className="flex items-center gap-1.5 rounded-full border border-wit-ink/12 bg-white px-3.5 py-2 text-xs font-bold text-wit-gray hover:border-wit-ink/25 hover:text-wit-ink"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t("Replanear mes", "Re-plan month")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label={t("Mes anterior", "Previous month")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-wit-ink/12 bg-white text-wit-gray hover:border-wit-ink/25"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            aria-label={t("Mes siguiente", "Next month")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-wit-ink/12 bg-white text-wit-gray hover:border-wit-ink/25"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-sm text-wit-gray">
        {t(
          "Organiza qué vas a publicar este mes — cada casilla es una solicitud lista para pedir.",
          "Organize what you'll publish this month — every square is a request ready to send.",
        )}
      </p>

      {confirmingReplan ? (
        <div className="wit-glass mt-4 flex flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-wit-ink">
            {t(
              `Se reemplazarán las ${pendingCount} piezas que aún no has pedido — lo que ya está en diseño o listo no se toca.`,
              `This will replace the ${pendingCount} pieces you haven't requested yet — anything already in design or ready stays untouched.`,
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingReplan(false)}
              disabled={replanning}
              className="rounded-full border border-wit-ink/15 px-4 py-2 text-xs font-bold text-wit-ink hover:border-wit-ink/30 disabled:opacity-50"
            >
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              onClick={replan}
              disabled={replanning}
              className="rounded-full bg-wit-blue px-4 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {replanning
                ? t("Reemplazando...", "Replacing...")
                : t("Sí, replanear", "Yes, re-plan")}
            </button>
          </div>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-wit-gray">
            <span>
              {t(
                `${requestedCount} de ${entries.length} piezas ya pedidas`,
                `${requestedCount} of ${entries.length} pieces requested`,
              )}
            </span>
            <span className="text-wit-blue">{progressPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-wit-mist/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-wit-blue to-wit-pink"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {entriesQuery.isLoading ? (
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-wit-mist/30" />
      ) : entries.length === 0 ? (
        <div className="wit-glass mt-6 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-wit-ink/15 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wit-blue/10 text-wit-blue">
            <Calendar className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <p className="text-base font-semibold text-wit-ink">
              {t(
                "Todavía no tienes un plan para este mes.",
                "You don't have a plan for this month yet.",
              )}
            </p>
            <p className="mt-1 max-w-sm text-sm text-wit-gray">
              {t(
                "Cuéntale a Wit tu cadencia y tus temas — en minutos tendrás el mes lleno de ideas listas para pedir.",
                "Tell Wit your posting cadence and topics — in minutes you'll have the month full of ideas ready to request.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="wit-glow-button rounded-full px-6 py-3 text-sm font-bold text-white"
          >
            {t("Planificar mi mes con Wit", "Plan my month with Wit")}
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* Desktop/tablet grid */}
          <div className="wit-glass hidden rounded-3xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)] sm:block">
            <div className="grid grid-cols-7 gap-2">
              {[
                t("Lun", "Mon"),
                t("Mar", "Tue"),
                t("Mié", "Wed"),
                t("Jue", "Thu"),
                t("Vie", "Fri"),
                t("Sáb", "Sat"),
                t("Dom", "Sun"),
              ].map((label) => (
                <div
                  key={label}
                  className="pl-1 text-[11px] font-bold uppercase tracking-wider text-wit-gray"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-2">
              {grid.map((cell) => {
                const entry = entryByDate.get(cell.date);
                const Icon = entry ? FORMAT_ICON[entry.format] : null;
                const isToday = cell.date === today;
                const isSelected = entry && entry.id === selectedId;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!entry}
                    onClick={() => entry && setSelectedId(entry.id)}
                    className={`flex min-h-[92px] flex-col gap-1.5 rounded-2xl border p-2 text-left transition-colors ${
                      isSelected
                        ? "border-2 border-wit-blue bg-white shadow-[0_6px_18px_rgba(0,71,255,0.14)]"
                        : cell.inMonth
                          ? "border-wit-ink/5 bg-white hover:border-wit-ink/15"
                          : "border-transparent bg-wit-mist/10"
                    } ${!entry ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span
                      className={`font-wit-mono text-xs ${
                        cell.inMonth
                          ? isToday
                            ? "font-bold text-wit-blue"
                            : "text-wit-ink"
                          : "text-wit-gray/40"
                      }`}
                    >
                      {Number(cell.date.slice(8, 10))}
                    </span>
                    {entry && Icon ? (
                      <span
                        className={`flex items-center gap-1 truncate rounded-lg px-1.5 py-1 text-[10px] font-semibold ${statusMeta(entry.status, t).badgeClass}`}
                      >
                        <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2.4} />
                        <span className="truncate">{entry.title}</span>
                      </span>
                    ) : isToday ? (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-wit-blue">
                        {t("Hoy", "Today")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile agenda list */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {entries.map((entry) => {
              const Icon = FORMAT_ICON[entry.format];
              const isSelected = entry.id === selectedId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${
                    isSelected ? "border-wit-blue bg-white" : "border-wit-ink/8 bg-white"
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wit-mist/40 text-wit-blue">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-wit-ink">
                      {entry.title}
                    </span>
                    <span className="block font-wit-mono text-[11px] text-wit-gray">
                      {formatDayLabel(entry.date, t)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusMeta(entry.status, t).badgeClass}`}
                  >
                    {statusMeta(entry.status, t).label}
                  </span>
                </button>
              );
            })}
          </div>

          {selected ? <EntryDetail entry={selected} /> : null}
        </div>
      )}

      {wizardOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-white">
              <CalendarWizard
                targetYear={year}
                targetMonth={month}
                monthLabel={monthLabel}
                onClose={() => setWizardOpen(false)}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
                  setWizardOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
