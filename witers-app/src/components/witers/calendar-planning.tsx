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
  Facebook,
  Flame,
  GalleryHorizontal,
  Image as ImageIcon,
  Instagram,
  Music2,
  RefreshCw,
  Send,
  Video as VideoIcon,
  X,
} from "lucide-react";

import { WMark } from "./brand";
import { ChatBubble } from "./chat-intake";
import { ASPECT_OPTIONS, AspectRatioPicker } from "./lab-pickers";
import { MicButton } from "./mic-button";
import { SlideGallery } from "./slide-gallery";
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
  // Solo presentes cuando status === "lista" — el contenido real ya
  // entregado. thumbHref es la miniatura para la casilla del calendario
  // (imagen o primera lámina de carrusel; null en video, que no tiene
  // fotograma guardado). deliveredImages es la galería completa para el
  // detalle. deliveredVideoHref es el src del reproductor, solo video.
  thumbHref: string | null;
  deliveredImages: string[] | null;
  deliveredVideoHref: string | null;
  // Copy sugerido para redes — null hasta que se genera la primera vez
  // que se abre la pieza (ver /api/calendar-entries-caption).
  caption: string | null;
};
type WitMessage = {
  role: "user" | "assistant";
  content: string;
  // Kept in the transcript sent to the backend (so Wit still "remembers"
  // what it proposed on a later turn) but not rendered as a chat bubble —
  // the plan review card below already shows that content nicely, so
  // showing it again as a wall of text in the thread would be redundant.
  hidden?: boolean;
};

// A compact plain-text recap of the proposed plan, injected into the
// message history right when Wit proposes it (see askWit's "done" branch)
// so that if the client later says they don't like it, Wit can read back
// what it already proposed instead of starting from zero. Kept short
// (date/format/title only, no full briefs) to stay well under the 2000-char
// per-message cap even for a month full of entries.
function buildPlanSummaryText(
  entries: CalendarEntryDraft[],
  t: (es: string, en: string) => string,
): string {
  const lines = entries.map((e) => `${e.date} · ${formatLabel(e.format, t)}: ${e.title}`);
  const text = t(
    `Plan propuesto para el mes:\n${lines.join("\n")}`,
    `Proposed plan for the month:\n${lines.join("\n")}`,
  );
  return text.length > 1900 ? `${text.slice(0, 1900)}…` : text;
}

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
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          year: targetYear,
          month: targetMonth,
        }),
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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: buildPlanSummaryText(data.entries, t), hidden: true },
        ]);
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

  // "No me gusta, ajustemos" — reopens the conversation instead of just
  // discarding the plan. The proposed plan is already in the transcript
  // (see the hidden summary message above), so Wit can ask what to change
  // instead of starting the whole conversation over.
  function rejectPlan() {
    if (!plan) return;
    setPlan(null);
    setSendError(null);
    const feedback = t(
      "No me gusta este plan, quiero ajustarlo.",
      "I don't like this plan, I want to adjust it.",
    );
    const next = [...messages, { role: "user" as const, content: feedback }];
    setMessages(next);
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
          {messages.map((m, i) =>
            m.hidden ? null : <ChatBubble key={i} role={m.role} text={m.content} />,
          )}
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
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={rejectPlan}
                    className="flex-1 rounded-full border border-wit-ink/15 px-4 py-3 text-sm font-bold text-wit-ink hover:border-wit-ink/30 disabled:opacity-50"
                  >
                    {t("No me gusta, ajustemos", "I don't like it, let's adjust")}
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={confirmPlan}
                    className="flex-1 rounded-full bg-wit-blue px-4 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
                  >
                    {sending
                      ? t("Guardando...", "Saving...")
                      : t("Confirmar plan del mes", "Confirm month's plan")}
                  </button>
                </div>
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

const EMPTY_SLIDES: CalendarSlideDraft[] = [
  { title: "", brief: "" },
  { title: "", brief: "" },
  { title: "", brief: "" },
  { title: "", brief: "" },
];

function EntryDetail({ entry }: { entry: CalendarEntry }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const Icon = FORMAT_ICON[entry.format];
  const meta = statusMeta(entry.status, t);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingFormat, setPickingFormat] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editBrief, setEditBrief] = useState(entry.brief);
  const [editSlides, setEditSlides] = useState<CalendarSlideDraft[]>(entry.slides ?? EMPTY_SLIDES);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState(entry.caption);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);

  async function generateCaption() {
    setGeneratingCaption(true);
    setCaptionError(null);
    try {
      const res = await fetch("/api/calendar-entries-caption", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      });
      const data = (await res.json()) as { ok: boolean; caption?: string };
      if (!data.ok || !data.caption) {
        setCaptionError(
          t(
            "No pudimos generar el copy. Intenta de nuevo.",
            "We couldn't generate the copy. Try again.",
          ),
        );
        return;
      }
      setCaptionText(data.caption);
      void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
    } catch {
      setCaptionError(
        t(
          "No pudimos generar el copy. Intenta de nuevo.",
          "We couldn't generate the copy. Try again.",
        ),
      );
    } finally {
      setGeneratingCaption(false);
    }
  }

  // Reset all per-entry UI state whenever the client switches to a
  // different day — otherwise the picker/editor could stay open showing
  // the wrong entry's fields. Auto-generates the suggested copy right away
  // if this entry doesn't have one cached yet, so it's ready by the time
  // the client scrolls down to it instead of needing an extra click.
  useEffect(() => {
    setPickingFormat(false);
    setError(null);
    setEditing(false);
    setSaveError(null);
    setEditTitle(entry.title);
    setEditBrief(entry.brief);
    setEditSlides(entry.slides ?? EMPTY_SLIDES);
    setCaptionText(entry.caption);
    setCaptionError(null);
    setCaptionCopied(false);
    if (!entry.caption) void generateCaption();
    // Only re-run on a day switch, not on every refetch of the same entry —
    // that would blow away in-progress edits after an unrelated invalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  async function copyCaption() {
    if (!captionText) return;
    try {
      await navigator.clipboard.writeText(captionText);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable — the text is still
      // right there on screen to copy by hand, nothing else to do.
    }
  }

  async function saveEdit() {
    setSaveError(null);
    if (!editTitle.trim()) {
      setSaveError(t("El título no puede quedar vacío.", "Title can't be empty."));
      return;
    }
    if (entry.format === "carrusel") {
      if (editSlides.some((s) => !s.brief.trim())) {
        setSaveError(
          t("Completa el contenido de las 4 láminas.", "Fill in all 4 slides' content."),
        );
        return;
      }
    } else if (!editBrief.trim()) {
      setSaveError(t("El brief no puede quedar vacío.", "Brief can't be empty."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/calendar-entries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          title: editTitle.trim(),
          // Para carrusel, brief queda como el resumen corto original —
          // el contenido real que se edita aquí vive en slides.
          brief: entry.format === "carrusel" ? entry.brief : editBrief.trim(),
          ...(entry.format === "carrusel"
            ? { slides: editSlides.map((s) => ({ title: s.title.trim(), brief: s.brief.trim() })) }
            : {}),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setSaveError(
          data.error === "ya_pedida"
            ? t(
                "Esta pieza ya fue pedida, no se puede editar.",
                "This piece was already requested, it can't be edited.",
              )
            : t(
                "No pudimos guardar los cambios. Intenta de nuevo.",
                "We couldn't save the changes. Try again.",
              ),
        );
        return;
      }
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
    } catch {
      setSaveError(
        t(
          "No pudimos guardar los cambios. Intenta de nuevo.",
          "We couldn't save the changes. Try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

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

      {entry.status === "lista" && entry.format === "video" && entry.deliveredVideoHref ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-wit-ink/5 bg-black">
          <video
            controls
            preload="metadata"
            className="block max-h-[70vh] w-full"
            src={entry.deliveredVideoHref}
          />
        </div>
      ) : entry.status === "lista" && entry.deliveredImages?.length ? (
        // Sin relación de aspecto forzada — la pieza puede ser 1:1, 3:4,
        // 9:16, etc., y forzarla a un cuadro cuadrado con object-cover
        // recortaba y ocultaba parte del contenido real. La imagen se
        // muestra a su proporción real, con el ancho de la columna como
        // único límite.
        <div className="mt-3 flex justify-center overflow-hidden rounded-2xl border border-wit-ink/5 bg-wit-mist/20">
          <SlideGallery
            key={entry.id}
            images={entry.deliveredImages}
            alt={entry.title}
            className="relative"
            imageClassName="block max-h-[70vh] w-full object-contain"
          />
        </div>
      ) : (
        <div className="mt-3 flex aspect-square items-center justify-center rounded-2xl border border-wit-ink/5 bg-gradient-to-br from-wit-mist/80 to-white/40">
          <Icon className="h-10 w-10 text-wit-blue/45" strokeWidth={1.6} />
        </div>
      )}

      {editing ? (
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          maxLength={120}
          className="mt-3.5 w-full rounded-xl border border-wit-ink/15 px-3 py-2 text-lg font-extrabold tracking-tight text-wit-ink outline-none focus:border-wit-blue"
        />
      ) : (
        <h3 className="mt-3.5 text-lg font-extrabold tracking-tight text-wit-ink">{entry.title}</h3>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-wit-mist/50 px-2.5 py-1 text-xs font-bold text-wit-gray">
          <Icon className="h-3 w-3" strokeWidth={2.4} />
          {formatLabel(entry.format, t)}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      {editing ? (
        entry.format === "carrusel" ? (
          <div className="mt-3.5 space-y-2.5">
            {editSlides.map((slide, si) => (
              <div key={si} className="rounded-xl bg-wit-mist/30 p-3">
                <p className="text-xs font-bold text-wit-blue">
                  {t(`Lámina ${si + 1}`, `Slide ${si + 1}`)}
                </p>
                <input
                  value={slide.title}
                  onChange={(e) =>
                    setEditSlides((prev) =>
                      prev.map((s, i) => (i === si ? { ...s, title: e.target.value } : s)),
                    )
                  }
                  maxLength={120}
                  placeholder={t("Título de la lámina", "Slide title")}
                  className="mt-1.5 w-full rounded-lg border border-wit-ink/15 px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-wit-blue"
                />
                <textarea
                  value={slide.brief}
                  onChange={(e) =>
                    setEditSlides((prev) =>
                      prev.map((s, i) => (i === si ? { ...s, brief: e.target.value } : s)),
                    )
                  }
                  rows={2}
                  maxLength={2000}
                  placeholder={t("Qué debe decir esta lámina", "What this slide should say")}
                  className="mt-1.5 w-full resize-none rounded-lg border border-wit-ink/15 px-2.5 py-1.5 text-xs outline-none focus:border-wit-blue"
                />
              </div>
            ))}
          </div>
        ) : (
          <textarea
            value={editBrief}
            onChange={(e) => setEditBrief(e.target.value)}
            rows={7}
            maxLength={2000}
            className="mt-3.5 w-full resize-none rounded-xl border border-wit-ink/15 px-3 py-2 text-sm leading-relaxed outline-none focus:border-wit-blue"
          />
        )
      ) : entry.format === "carrusel" && entry.slides?.length ? (
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

      {editing ? null : (
        <div className="mt-3.5 rounded-2xl border border-wit-ink/5 bg-wit-mist/30 p-3.5">
          <p className="text-xs font-bold uppercase tracking-wider text-wit-gray">
            {t("Copy sugerido", "Suggested copy")}
          </p>
          {generatingCaption ? (
            <p className="mt-2 text-sm text-wit-gray">
              {t("Generando copy...", "Generating copy...")}
            </p>
          ) : captionText ? (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-wit-ink">
                {captionText}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={copyCaption}
                  className="rounded-full border border-wit-ink/15 bg-white px-3.5 py-1.5 text-xs font-bold text-wit-ink hover:border-wit-ink/30"
                >
                  {captionCopied ? t("Copiado ✓", "Copied ✓") : t("Copiar", "Copy")}
                </button>
                <button
                  type="button"
                  disabled={generatingCaption}
                  onClick={generateCaption}
                  className="rounded-full border border-wit-ink/15 bg-white px-3.5 py-1.5 text-xs font-bold text-wit-ink hover:border-wit-ink/30 disabled:opacity-50"
                >
                  {t("Regenerar", "Regenerate")}
                </button>
              </div>
            </>
          ) : captionError ? (
            <div className="mt-2">
              <p className="text-xs text-red-600">{captionError}</p>
              <button
                type="button"
                onClick={generateCaption}
                className="mt-1 text-sm font-semibold text-wit-blue hover:underline"
              >
                {t("Reintentar", "Try again")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={generateCaption}
              className="mt-2 text-sm font-semibold text-wit-blue hover:underline"
            >
              {t("Generar copy", "Generate copy")}
            </button>
          )}
        </div>
      )}

      {editing ? null : <PublishSection entry={entry} />}

      {entry.status !== "por_planear" ? null : editing ? (
        <div className="mt-4">
          {saveError ? <p className="mb-2 text-xs text-red-600">{saveError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 rounded-full border border-wit-ink/15 px-4 py-2.5 text-xs font-bold text-wit-ink hover:border-wit-ink/30 disabled:opacity-50"
            >
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="flex-1 rounded-full bg-wit-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {saving ? t("Guardando...", "Saving...") : t("Guardar cambios", "Save changes")}
            </button>
          </div>
        </div>
      ) : pickingFormat ? (
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
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={requesting}
            onClick={() => setPickingFormat(true)}
            className="wit-glow-button w-full rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {requesting
              ? t("Enviando...", "Sending...")
              : t("Pedir esta pieza a Wit", "Request this piece from Wit")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-full border border-wit-ink/15 px-4 py-2.5 text-xs font-bold text-wit-ink hover:border-wit-ink/30"
          >
            {t("Editar", "Edit")}
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

/* ---------- publicar a redes ---------- */

type SocialPlatform = "facebook" | "instagram";
type ConnectionsState = Record<SocialPlatform, { name: string | null } | null>;
const EMPTY_CONNECTIONS: ConnectionsState = { facebook: null, instagram: null };

async function fetchConnections(): Promise<ConnectionsState> {
  const res = await fetch("/api/social/connections");
  const data = (await res.json()) as { ok: boolean; connections?: ConnectionsState };
  return data.ok && data.connections ? data.connections : EMPTY_CONNECTIONS;
}

// Tira de "Conexiones" arriba del calendario — Instagram se conecta
// directo con su propia cuenta (sin pasar por Facebook), y Facebook se
// conecta aparte con su Página. Cada ícono manda a su propio flujo de
// OAuth. TikTok no tiene integración todavía, se muestra deshabilitado.
function ConnectionsStrip() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingPages, setPendingPages] = useState<
    { id: string; name: string; instagramUserId: string | null }[]
  >([]);

  const { data: connections = EMPTY_CONNECTIONS } = useQuery({
    queryKey: ["social-connections"],
    queryFn: fetchConnections,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("social_connected");
    const pick = params.get("social_pick");
    const err = params.get("social_error");
    if (connected) {
      setNotice(t("¡Cuenta conectada!", "Account connected!"));
      void qc.invalidateQueries({ queryKey: ["social-connections"] });
    } else if (pick) {
      setPendingId(pick);
      fetch(`/api/social/connect/pending?id=${encodeURIComponent(pick)}`)
        .then((res) => res.json())
        .then((data: { ok: boolean; pages?: typeof pendingPages }) => {
          if (data.ok && data.pages) setPendingPages(data.pages);
        })
        .catch(() => {});
    } else if (err) {
      setNotice(
        t(
          "No pudimos conectar la cuenta. Intenta de nuevo.",
          "We couldn't connect the account. Try again.",
        ),
      );
    }
    if (connected || pick || err) {
      const url = new URL(window.location.href);
      url.searchParams.delete("social_connected");
      url.searchParams.delete("social_pick");
      url.searchParams.delete("social_error");
      window.history.replaceState({}, "", url.toString());
    }
    // Solo al montar — leemos los query params del round-trip de OAuth una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choosePage(pageId: string) {
    if (!pendingId) return;
    await fetch("/api/social/connect/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingId, pageId }),
    });
    setPendingId(null);
    setPendingPages([]);
    setNotice(t("¡Cuenta conectada!", "Account connected!"));
    void qc.invalidateQueries({ queryKey: ["social-connections"] });
  }

  async function disconnect(platform: SocialPlatform) {
    await fetch(`/api/social/connections?platform=${platform}`, { method: "DELETE" });
    void qc.invalidateQueries({ queryKey: ["social-connections"] });
  }

  function Pill({
    icon: PillIcon,
    label,
    platform,
  }: {
    icon: typeof Instagram;
    label: string;
    platform: SocialPlatform;
  }) {
    const connection = connections[platform];
    if (connection) {
      return (
        <button
          type="button"
          onClick={() => disconnect(platform)}
          title={t(`Desconectar ${label}`, `Disconnect ${label}`)}
          className="flex items-center gap-1.5 rounded-full border border-wit-blue/25 bg-wit-blue/10 px-3 py-1.5 text-xs font-bold text-wit-blue"
        >
          <PillIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
          {connection.name ?? label}
        </button>
      );
    }
    const connectHref =
      platform === "instagram"
        ? "/api/social/connect/instagram/start"
        : "/api/social/connect/start";
    return (
      <a
        href={connectHref}
        className="flex items-center gap-1.5 rounded-full border border-wit-ink/12 bg-white px-3 py-1.5 text-xs font-bold text-wit-gray hover:border-wit-ink/25 hover:text-wit-ink"
      >
        <PillIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
        {t(`Conectar ${label}`, `Connect ${label}`)}
      </a>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Pill icon={Instagram} label="Instagram" platform="instagram" />
      <Pill icon={Facebook} label="Facebook" platform="facebook" />
      <span
        title={t("Próximamente", "Coming soon")}
        className="flex items-center gap-1.5 rounded-full border border-wit-ink/8 bg-wit-mist/40 px-3 py-1.5 text-xs font-bold text-wit-gray/60"
      >
        <Music2 className="h-3.5 w-3.5" strokeWidth={2.2} />
        TikTok · {t("Próximamente", "Coming soon")}
      </span>
      {notice ? <p className="text-xs font-semibold text-wit-gray">{notice}</p> : null}
      {pendingId && pendingPages.length > 0 ? (
        <div className="mt-1 w-full rounded-2xl border border-wit-ink/10 bg-white p-3">
          <p className="text-xs font-bold text-wit-ink">
            {t("¿Cuál página de Facebook conectamos?", "Which Facebook Page should we connect?")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingPages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => choosePage(page.id)}
                className="rounded-full border border-wit-ink/15 px-3 py-1.5 text-xs font-bold text-wit-ink hover:border-wit-ink/30"
              >
                {page.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Botón "Publicar" junto al copy sugerido — solo aparece para piezas ya
// "lista". Videos se envían a Meta y continúan procesándose en segundo plano;
// imágenes y carruseles se publican durante la misma solicitud.
function PublishSection({ entry }: { entry: CalendarEntry }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<SocialPlatform>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const { data: connections = EMPTY_CONNECTIONS } = useQuery({
    queryKey: ["social-connections"],
    queryFn: fetchConnections,
  });
  const videoPublicationsQuery = useQuery({
    queryKey: ["calendar-entry-video-publications", entry.id],
    enabled: entry.status === "lista" && entry.format === "video",
    queryFn: async () => {
      const res = await fetch(`/api/calendar-entries-publish?entryId=${encodeURIComponent(entry.id)}`);
      const data = (await res.json()) as {
        ok: boolean;
        videoPublications?: {
          platform: SocialPlatform;
          status: "processing" | "success" | "error";
          error: string | null;
          created_at: string;
        }[];
      };
      return data.ok ? data.videoPublications ?? [] : [];
    },
    refetchInterval: (query) =>
      query.state.data?.some((publication) => publication.status === "processing") ? 10_000 : false,
  });

  if (entry.status !== "lista") return null;

  const connectedPlatforms = (["instagram", "facebook"] as SocialPlatform[]).filter(
    (p) => connections[p],
  );

  function toggle(platform: SocialPlatform) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  function platformLabel(platform: SocialPlatform): string {
    return platform === "instagram" ? "Instagram" : "Facebook";
  }

  async function publish() {
    if (selected.size === 0) return;
    setPublishing(true);
    setPublishError(null);
    setPublishNotice(null);
    try {
      const res = await fetch("/api/calendar-entries-publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, platforms: Array.from(selected) }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        results?: Record<string, { ok: boolean; processing?: boolean; error?: string }>;
      };
      if (!data.ok || !data.results) {
        setPublishError(
          t("No pudimos publicar. Intenta de nuevo.", "We couldn't publish. Try again."),
        );
        return;
      }
      const lines = Object.entries(data.results).map(([platform, result]) =>
        result.ok
          ? result.processing
            ? t(
                `◌ Procesando video para ${platformLabel(platform as SocialPlatform)}. Puede tardar unos minutos.`,
                `◌ Processing video for ${platformLabel(platform as SocialPlatform)}. This can take a few minutes.`,
              )
            : t(
              `✓ Publicado en ${platformLabel(platform as SocialPlatform)}`,
              `✓ Published to ${platformLabel(platform as SocialPlatform)}`,
            )
          : t(
              `✗ Error al publicar en ${platformLabel(platform as SocialPlatform)}${result.error ? `: ${result.error}` : ""}`,
              `✗ Failed to publish to ${platformLabel(platform as SocialPlatform)}${result.error ? `: ${result.error}` : ""}`,
            ),
      );
      setPublishNotice(lines.join(" · "));
      if (entry.format === "video") {
        void queryClient.invalidateQueries({
          queryKey: ["calendar-entry-video-publications", entry.id],
        });
      }
      // Un error trae el motivo real de Meta, útil para diagnosticar — se
      // queda visible más tiempo que una confirmación simple de éxito.
      const hasError = Object.values(data.results).some((r) => !r.ok);
      const hasProcessing = Object.values(data.results).some((r) => r.processing);
      setTimeout(() => setPublishNotice(null), hasError || hasProcessing ? 12000 : 4000);
    } catch {
      setPublishError(
        t("No pudimos publicar. Intenta de nuevo.", "We couldn't publish. Try again."),
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="mt-3.5 rounded-2xl border border-wit-ink/5 bg-wit-mist/30 p-3.5">
      <p className="text-xs font-bold uppercase tracking-wider text-wit-gray">
        {t("Publicar", "Publish")}
      </p>
      {entry.format === "video" ? (
        <>
          <p className="mt-1 text-xs text-wit-gray">
            {t(
              "Meta procesa el video antes de publicarlo. Puedes salir de esta pantalla: WITERS continúa el proceso.",
              "Meta processes the video before publishing it. You can leave this screen: WITERS continues the process.",
            )}
          </p>
          {videoPublicationsQuery.data?.[0] ? (
            <div className="mt-2 space-y-1 text-xs font-semibold text-wit-gray">
              {videoPublicationsQuery.data.slice(0, 2).map((publication) => {
                const platform = platformLabel(publication.platform as SocialPlatform);
                return (
                  <p key={`${publication.platform}-${publication.created_at}`}>
                    {publication.status === "processing"
                      ? t(
                          `${platform}: el envío sigue procesándose en Meta.`,
                          `${platform}: the submission is still processing in Meta.`,
                        )
                      : publication.status === "success"
                        ? t(
                            `✓ ${platform}: publicado correctamente.`,
                            `✓ ${platform}: published successfully.`,
                          )
                        : t(
                            `✗ ${platform}: no se publicó${publication.error ? ` — ${publication.error}` : "."}`,
                            `✗ ${platform}: did not publish${publication.error ? ` — ${publication.error}` : "."}`,
                          )}
                  </p>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
      {connectedPlatforms.length === 0 ? (
        <p className="mt-2 text-sm text-wit-gray">
          {t(
            "Conecta Instagram o Facebook arriba del calendario para publicar directo desde aquí.",
            "Connect Instagram or Facebook above the calendar to publish straight from here.",
          )}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-3">
            {connectedPlatforms.map((platform) => (
              <label key={platform} className="flex items-center gap-1.5 text-sm text-wit-ink">
                <input
                  type="checkbox"
                  checked={selected.has(platform)}
                  onChange={() => toggle(platform)}
                  className="h-4 w-4 rounded border-wit-ink/25"
                />
                {platform === "instagram" ? "Instagram" : "Facebook"}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={selected.size === 0 || publishing}
            onClick={publish}
            className="wit-glow-button mt-3 flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2.4} />
            {publishing ? t("Publicando...", "Publishing...") : t("Publicar", "Publish")}
          </button>
          {publishError ? <p className="mt-2 text-xs text-red-600">{publishError}</p> : null}
          {publishNotice ? (
            <p className="mt-2 text-xs font-semibold text-wit-gray">{publishNotice}</p>
          ) : null}
        </>
      )}
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
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-extrabold tracking-tighter text-wit-ink sm:text-4xl">
          {t("Planificación", "Planning")}
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
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmingReplan(true)}
              className="flex items-center gap-1.5 rounded-full border border-wit-ink/12 bg-white px-3.5 py-2 text-xs font-bold text-wit-gray hover:border-wit-ink/25 hover:text-wit-ink"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
              {pendingCount > 0
                ? t("Replanear mes", "Re-plan month")
                : t("Planificar más", "Plan more")}
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

      <ConnectionsStrip />

      {confirmingReplan ? (
        <div className="wit-glass mt-4 flex flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-wit-ink">
            {pendingCount > 0
              ? t(
                  `Se reemplazarán las ${pendingCount} piezas que aún no has pedido — lo que ya está en diseño o listo no se toca.`,
                  `This will replace the ${pendingCount} pieces you haven't requested yet — anything already in design or ready stays untouched.`,
                )
              : t(
                  "Vamos a planificar el resto del mes con Wit — lo que ya está en diseño o listo no se toca.",
                  "Let's plan the rest of the month with Wit — anything already in design or ready stays untouched.",
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
                ? t("Cargando...", "Loading...")
                : pendingCount > 0
                  ? t("Sí, replanear", "Yes, re-plan")
                  : t("Sí, continuar", "Yes, continue")}
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
          {/* Same grid at every size — only the density changes (smaller
              cells/text on a phone) instead of swapping to a separate
              agenda-list layout on mobile. */}
          <div className="wit-glass rounded-3xl p-2.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)] sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
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
                  className="truncate py-1 text-center text-[8px] font-bold uppercase tracking-wider text-wit-gray sm:text-[10px]"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-1.5 sm:gap-1.5">
              {grid.map((cell) => {
                const entry = entryByDate.get(cell.date);
                const Icon = entry ? FORMAT_ICON[entry.format] : null;
                const isToday = cell.date === today;
                const isSelected = entry && entry.id === selectedId;
                const hasThumb = Boolean(entry && entry.status === "lista" && entry.thumbHref);
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!entry}
                    onClick={() => entry && setSelectedId(entry.id)}
                    className={`relative flex min-h-[50px] flex-col overflow-hidden rounded-lg border p-1 text-left transition-all duration-200 sm:min-h-[76px] sm:rounded-xl sm:p-1.5 ${
                      isSelected
                        ? "border-2 border-wit-blue bg-white shadow-[0_6px_18px_rgba(0,71,255,0.14)]"
                        : cell.inMonth
                          ? entry && !hasThumb
                            ? entry.status === "lista"
                              ? "border-emerald-200/80 bg-emerald-50/70 hover:border-emerald-300"
                              : entry.status === "en_diseno"
                                ? "border-wit-blue/15 bg-wit-blue/[0.045] hover:border-wit-blue/35"
                                : "border-wit-ink/7 bg-white hover:border-wit-ink/18"
                            : "border-wit-ink/5 bg-white hover:border-wit-ink/15"
                          : "border-transparent bg-wit-mist/10"
                    } ${!entry ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {hasThumb ? (
                      <>
                        <img src={entry!.thumbHref!} alt={entry!.title} className="absolute inset-0 h-full w-full object-cover" />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/10" />
                      </>
                    ) : null}
                    <span
                      className={`relative z-10 font-wit-mono text-[8px] sm:text-xs ${
                        hasThumb
                          ? "font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                          : cell.inMonth
                            ? isToday
                              ? "font-bold text-wit-blue"
                              : "text-wit-ink"
                            : "text-wit-gray/40"
                      }`}
                    >
                      {Number(cell.date.slice(8, 10))}
                    </span>
                    {entry && Icon ? (
                      hasThumb ? (
                        <span className="absolute bottom-1 right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white sm:h-5 sm:w-5">
                          <Icon className="h-2.5 w-2.5" strokeWidth={2.4} />
                        </span>
                      ) : (
                        <span className={`relative z-10 mt-auto flex flex-col items-start gap-0.5 overflow-hidden rounded-md px-1 py-0.5 text-[8px] font-semibold sm:rounded-lg sm:px-1.5 sm:py-1 ${statusMeta(entry.status, t).badgeClass}`}>
                          <span className="flex items-center gap-1">
                          <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2.4} />
                            <span className="hidden text-[8px] font-bold uppercase tracking-wide sm:inline">{formatLabel(entry.format, t)}</span>
                          </span>
                          <span className="hidden w-full truncate text-[9px] font-semibold leading-tight sm:inline">{entry.title}</span>
                        </span>
                      )
                    ) : isToday ? (
                      <span className="relative z-10 text-[7px] font-bold uppercase tracking-wide text-wit-blue sm:text-[9px]">
                        {t("Hoy", "Today")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
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
