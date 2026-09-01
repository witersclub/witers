// Client-facing "Planificación" — a monthly content calendar Wit fills in
// one conversation (see /api/wit/calendar-chat), which the client reviews
// and confirms before it's saved (see /api/calendar-entries), same
// "propose, then a review card the client explicitly confirms" shape as
// CarouselWizard in carousel-requests.tsx. Tapping a day's piece creates the
// real request in one click for all three formats — carrusel arrives with
// its 4 slides already structured by Wit at planning time, and video with
// no uploaded file (the guion becomes the AI-scenes note) — see
// /api/calendar-entries-request.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Facebook,
  FileText,
  Flame,
  GalleryHorizontal,
  Image as ImageIcon,
  Instagram,
  Loader2,
  Megaphone,
  Music2,
  PenLine,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  Video as VideoIcon,
  X,
  Youtube,
} from "lucide-react";

import { WMark } from "./brand";
import { ChatBubble } from "./chat-intake";
import { CampaignCreationSheet } from "./campaign-creation-sheet";
import { ASPECT_OPTIONS, AspectRatioPicker } from "./lab-pickers";
import { MicButton } from "./mic-button";
import { SlideGallery } from "./slide-gallery";
import { extractBrandDocumentText } from "../../lib/brand-document-text";
import { buildCalendarPlanPdf } from "../../lib/calendar-plan-pdf";
import { downloadPdf } from "../../lib/campaign-report-pdf";
import { useLanguage } from "../../lib/i18n";

// video no soporta 4:3/3:4 (ver el enum real en video-requests.ts) — se le
// muestra un subconjunto del mismo picker en vez de uno aparte.
const VIDEO_ASPECT_VALUES = new Set(["1:1", "16:9", "9:16"]);

type CalendarFormat = "imagen" | "video" | "carrusel";
type CalendarSlideDraft = { title: string; brief: string };
type CalendarEntryDraft = {
  date: string;
  slot?: number;
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
  publicationStatus:
    "scheduled" | "publishing" | "published" | "partial" | "error" | "canceled" | null;
  scheduledForUtc: string | null;
  publicationTimezone: string | null;
  publicationPlatforms: SocialPlatform[] | null;
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

function publicationStatusMeta(entry: CalendarEntry, t: (es: string, en: string) => string) {
  if (entry.publicationStatus === "scheduled")
    return { label: t("Programada", "Scheduled"), cls: "bg-violet-50 text-violet-700" };
  if (entry.publicationStatus === "publishing")
    return { label: t("Publicando", "Publishing"), cls: "bg-amber-50 text-amber-700" };
  if (entry.publicationStatus === "published")
    return { label: t("Publicada", "Published"), cls: "bg-emerald-50 text-emerald-700" };
  if (entry.publicationStatus === "partial")
    return {
      label: t("Publicada parcialmente", "Partially published"),
      cls: "bg-amber-50 text-amber-700",
    };
  if (entry.publicationStatus === "error")
    return { label: t("Error de publicación", "Publishing error"), cls: "bg-red-50 text-red-700" };
  if (entry.publicationStatus === "canceled")
    return { label: t("Cancelada", "Canceled"), cls: "bg-wit-mist/50 text-wit-gray" };
  const designStatus = statusMeta(entry.status, t);
  return { label: designStatus.label, cls: designStatus.badgeClass };
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
  initialBrandMindOpen = false,
}: {
  targetYear: number;
  targetMonth: number;
  monthLabel: string;
  onClose: () => void;
  onCreated: () => void;
  initialBrandMindOpen?: boolean;
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
  const [brandMindOpen, setBrandMindOpen] = useState(initialBrandMindOpen);
  const [brandAssets, setBrandAssets] = useState<
    { id: string; original_name: string; kind: string; use_in_planning: number }[]
  >([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetError, setAssetError] = useState<string | null>(null);
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

  async function loadBrandAssets() {
    try {
      const res = await fetch("/api/brand-profile", { credentials: "include" });
      const data = (await res.json()) as { ok: boolean; assets?: typeof brandAssets };
      if (!data.ok) return;
      const assets = data.assets ?? [];
      setBrandAssets(assets);
      setSelectedAssetIds(assets.filter((a) => a.use_in_planning === 1).map((a) => a.id));
    } catch {
      setAssetError(
        t("No pudimos cargar tus archivos de marca.", "We couldn't load your brand files."),
      );
    }
  }

  async function uploadBrandAsset(file: File | null) {
    if (!file) return;
    setAssetError(null);
    if (file.type.startsWith("video/")) {
      setAssetError(
        t(
          "Por ahora agrega videos desde Mi marca; aquí puedes usar imágenes, PDF o un archivo de texto de estrategia.",
          "For now add videos from My brand; here you can use images, PDFs, or a strategy text file.",
        ),
      );
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upload = await fetch("/api/upload-reference", { method: "POST", body: fd });
      const uploaded = (await upload.json()) as { ok: boolean; key?: string };
      if (!uploaded.ok || !uploaded.key) throw new Error("upload");
      const extraction = await extractBrandDocumentText(file);
      const textContent = extraction.text;
      const save = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add_asset",
          key: uploaded.key,
          originalName: file.name,
          kind: textContent ? "strategy" : file.type === "application/pdf" ? "manual" : "reference",
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          textContent,
        }),
      });
      if (!save.ok) throw new Error("save");
      await loadBrandAssets();
      if (!extraction.readable)
        setAssetError(
          t(
            "Archivo guardado como referencia visual. Para que Wit lea el contenido, usa .txt, .md, .json o .docx.",
            "File saved as a visual reference. For Wit to read its content, use .txt, .md, .json, or .docx.",
          ),
        );
    } catch {
      setAssetError(
        t(
          "No pudimos guardar el archivo. Intenta de nuevo.",
          "We couldn't save the file. Try again.",
        ),
      );
    }
  }

  async function askWit(next: WitMessage[]) {
    setTyping(true);
    setChatError(null);
    try {
      // When the client explicitly asks to fill the whole month, make that
      // promise executable: a five-day partial answer must never look like
      // a completed monthly plan.
      const asksForFullMonth = next.some(
        (m) =>
          m.role === "user" &&
          /(?:todo el mes|mes completo|todos los d[ií]as|diario|entire month|whole month|every day)/i.test(
            m.content,
          ),
      );
      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
      const res = await fetch("/api/wit/calendar-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          year: targetYear,
          month: targetMonth,
          brandAssetIds: selectedAssetIds,
          expectedEntries: asksForFullMonth ? daysInTargetMonth : undefined,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: "message"; text: string }
        | { ok: true; kind: "done"; entries: CalendarEntryDraft[] }
        | { ok: false; error: string };
      if (!data.ok) {
        setChatError(
          data.error === "plan_incompleto"
            ? t(
                "Wit no alcanzó a completar todas las piezas pendientes. Tu calendario no se modificó; intenta de nuevo para que continúe el plan.",
                "Wit didn't finish all pending pieces. Your calendar was not changed; try again so it can continue the plan.",
              )
            : data.error === "falta_openai_api_key"
              ? t(
                  "Wit no está configurado todavía. Revisa la configuración de IA e intenta de nuevo.",
                  "Wit isn't configured yet. Check the AI configuration and try again.",
                )
              : t(
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

      <button
        type="button"
        onClick={() => {
          setBrandMindOpen(true);
          void loadBrandAssets();
        }}
        className="mb-1 flex w-full items-center justify-between rounded-2xl border border-wit-blue/10 bg-wit-blue/[0.04] px-4 py-3 text-left transition-colors hover:bg-wit-blue/[0.08]"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-wit-blue shadow-sm">
            <FileText className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-bold text-wit-ink">
              {t("Mente de marca", "Brand mind")}
            </span>
            <span className="block text-xs text-wit-gray">
              {selectedAssetIds.length
                ? t(
                    `${selectedAssetIds.length} archivos activos para este plan`,
                    `${selectedAssetIds.length} files active for this plan`,
                  )
                : t(
                    "Agrega contexto para que Wit conozca tu marca",
                    "Add context so Wit knows your brand",
                  )}
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-wit-blue" />
      </button>

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
      {brandMindOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end bg-wit-ink/20 p-0 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-label={t("Mente de marca", "Brand mind")}
            >
              <div className="w-full rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 shadow-2xl md:mx-auto md:mb-8 md:max-w-lg md:rounded-[28px]">
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-wit-ink/15" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-extrabold text-wit-ink">
                      {t("Mente de marca", "Brand mind")}
                    </p>
                    <p className="mt-0.5 text-sm text-wit-gray">
                      {t(
                        "Elige qué archivos debe considerar Wit en este plan.",
                        "Choose which files Wit should consider for this plan.",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBrandMindOpen(false)}
                    aria-label={t("Cerrar", "Close")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-wit-mist text-wit-ink"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void uploadBrandAsset(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className="mt-5 flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-wit-blue/35 bg-wit-blue/[0.03] px-4 py-3 text-sm font-bold text-wit-blue transition-colors hover:bg-wit-blue/[0.07]"
                >
                  <Upload className="h-4 w-4" />
                  {t("Cargar o arrastrar archivo", "Upload or drop a file")}
                  <span className="text-[11px] font-medium text-wit-gray">
                    {t("Suelta el archivo aquí", "Drop the file here")}
                  </span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docs,.docx,.md,.markdown,.txt,.text,application/json"
                    onChange={(e) => void uploadBrandAsset(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="mt-4 max-h-[45dvh] space-y-2 overflow-y-auto">
                  {brandAssets.length ? (
                    brandAssets.map((asset) => (
                      <label
                        key={asset.id}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-wit-ink/8 px-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={(e) =>
                            setSelectedAssetIds((current) =>
                              e.target.checked
                                ? [...current, asset.id]
                                : current.filter((id) => id !== asset.id),
                            )
                          }
                          className="h-4 w-4 accent-[#315BFF]"
                        />
                        <FileText className="h-4 w-4 shrink-0 text-wit-blue" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-wit-ink">
                          {asset.original_name}
                        </span>
                        <span className="text-xs capitalize text-wit-gray">{asset.kind}</span>
                      </label>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-wit-mist/50 px-4 py-5 text-center text-sm text-wit-gray">
                      {t(
                        "Aún no tienes archivos. Sube tu manual, estrategia o referencias.",
                        "You don't have files yet. Upload your manual, strategy, or references.",
                      )}
                    </p>
                  )}
                </div>
                {assetError ? <p className="mt-3 text-sm text-red-600">{assetError}</p> : null}
                <button
                  type="button"
                  onClick={() => setBrandMindOpen(false)}
                  className="mt-5 w-full rounded-2xl bg-wit-blue py-3.5 text-sm font-bold text-white"
                >
                  {t("Usar en esta planificación", "Use in this plan")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
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

function EntryDetail({ entry, onClose }: { entry: CalendarEntry; onClose: () => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const Icon = FORMAT_ICON[entry.format];
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
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(entry.caption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const pointerRef = useRef<{ id: number; startY: number; lastY: number; lastAt: number } | null>(
    null,
  );
  const draggingRef = useRef(false);
  const [isMobileSheet, setIsMobileSheet] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const [sheetOffset, setSheetOffset] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 1000,
  );
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);

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
    setEditingCaption(false);
    setCaptionDraft(entry.caption ?? "");
    const params = new URLSearchParams(window.location.search);
    const shouldResumeCampaign =
      params.get("campaign") === "1" && params.get("campaign_entry") === entry.id;
    setCampaignOpen(shouldResumeCampaign);
    if (shouldResumeCampaign) {
      params.delete("campaign");
      params.delete("campaign_entry");
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`,
      );
    }
    if (!entry.caption) void generateCaption();
    // Only re-run on a day switch, not on every refetch of the same entry —
    // that would blow away in-progress edits after an unrelated invalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !savingCaption) requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    onClose,
    saving,
    savingCaption,
    editing,
    editingCaption,
    captionDraft,
    captionText,
    editTitle,
    editBrief,
  ]);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileSheet(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMobileSheet) return;
    const height = sheetRef.current?.getBoundingClientRect().height || window.innerHeight;
    setSheetOffset(height);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSheetOffset(0));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isMobileSheet, entry.id]);

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

  async function saveCaption() {
    if (!captionDraft.trim() || captionDraft.trim() === captionText || savingCaption) return;
    setSavingCaption(true);
    setCaptionError(null);
    try {
      const res = await fetch("/api/calendar-entries-caption", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, caption: captionDraft }),
      });
      const data = (await res.json()) as { ok: boolean; caption?: string };
      if (!data.ok || !data.caption) throw new Error("save_caption_failed");
      setCaptionText(data.caption);
      setCaptionDraft(data.caption);
      setEditingCaption(false);
      void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
    } catch {
      setCaptionError(
        t("No pudimos guardar el copy. Intenta de nuevo.", "We couldn't save the copy. Try again."),
      );
    } finally {
      setSavingCaption(false);
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

  function finishClose() {
    if (!isMobileSheet) {
      onClose();
      return;
    }
    const height = sheetRef.current?.getBoundingClientRect().height || window.innerHeight;
    setClosing(true);
    draggingRef.current = false;
    setDragging(false);
    setSheetOffset(height);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimerRef.current = window.setTimeout(onClose, reducedMotion ? 0 : 430);
  }

  function requestClose() {
    const copyDirty = editingCaption && captionDraft.trim() !== (captionText ?? "");
    const pieceDirty = editing && (editTitle !== entry.title || editBrief !== entry.brief);
    if (
      (copyDirty || pieceDirty) &&
      !window.confirm(
        t(
          "Tienes cambios sin guardar. ¿Cerrar de todos modos?",
          "You have unsaved changes. Close anyway?",
        ),
      )
    )
      return;
    finishClose();
  }

  function onSheetPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isMobileSheet || closing || event.button !== 0) return;
    pointerRef.current = {
      id: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: performance.now(),
    };
  }

  function onSheetPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!isMobileSheet || !pointer || pointer.id !== event.pointerId || closing) return;
    const deltaY = Math.max(0, event.clientY - pointer.startY);
    // Normal content scrolling wins until the user returns to the very top.
    // Only then does a downward pull become a dismissal gesture.
    if (dialogRef.current?.scrollTop && !draggingRef.current) return;
    if (deltaY <= 0) return;
    if (!draggingRef.current) {
      draggingRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    pointer.lastY = event.clientY;
    pointer.lastAt = performance.now();
    event.preventDefault();
    setSheetOffset(deltaY);
  }

  function onSheetPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!isMobileSheet || !pointer || pointer.id !== event.pointerId) return;
    const deltaY = Math.max(0, event.clientY - pointer.startY);
    const elapsed = Math.max(1, performance.now() - pointer.lastAt);
    const velocityY = Math.max(0, event.clientY - pointer.lastY) / elapsed;
    pointerRef.current = null;
    if (!draggingRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const height = sheetRef.current?.getBoundingClientRect().height || window.innerHeight;
    draggingRef.current = false;
    setDragging(false);
    if (deltaY >= height * 0.25 || velocityY > 0.6) {
      requestClose();
    } else {
      setSheetOffset(0);
    }
  }

  const publicationMeta = publicationStatusMeta(entry, t);
  const previewHref = entry.deliveredVideoHref ?? entry.deliveredImages?.[0] ?? null;
  const sheetHeight =
    sheetRef.current?.getBoundingClientRect().height ||
    (typeof window !== "undefined" ? window.innerHeight : 1000);
  const sheetProgress = isMobileSheet ? Math.min(1, Math.max(0, sheetOffset / sheetHeight)) : 0;
  const glassBlur = 20 - sheetProgress * 11;
  const backdropOpacity = isMobileSheet ? 0.15 * (1 - sheetProgress) : 0.55;
  const backdropBlur = isMobileSheet ? 2 * (1 - sheetProgress) : 2;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] motion-reduce:transition-none"
      style={{
        backgroundColor: `rgba(5, 10, 25, ${backdropOpacity})`,
        backdropFilter: `blur(${backdropBlur}px)`,
        WebkitBackdropFilter: `blur(${backdropBlur}px)`,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !savingCaption) requestClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-entry-detail-title"
        tabIndex={-1}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={onSheetPointerEnd}
        onPointerCancel={onSheetPointerEnd}
        className={`absolute inset-0 isolate flex h-[100dvh] flex-col overflow-hidden rounded-t-[28px] bg-white/90 outline-none motion-reduce:transition-none md:inset-x-4 md:top-[4vh] md:mx-auto md:h-[92dvh] md:max-w-3xl md:rounded-3xl md:bg-white md:shadow-[0_30px_80px_rgba(5,13,40,0.32)] ${dragging || closing ? "will-change-transform transition-none" : "transition-transform duration-[430ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0"}`}
        style={
          isMobileSheet
            ? {
                transform: `translate3d(0, ${sheetOffset}px, 0)`,
                backdropFilter: `blur(${12 - sheetProgress * 4}px) saturate(${120 - sheetProgress * 12}%)`,
                WebkitBackdropFilter: `blur(${12 - sheetProgress * 4}px) saturate(${120 - sheetProgress * 12}%)`,
              }
            : undefined
        }
      >
        <header
          className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/55 px-5 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] shadow-[0_8px_24px_rgba(5,13,40,0.04)] md:bg-white md:px-7 md:pb-3 md:pt-6"
          style={
            isMobileSheet
              ? {
                  backgroundColor: `rgba(255, 255, 255, ${0.86 - sheetProgress * 0.1})`,
                  backdropFilter: `blur(${glassBlur}px) saturate(${150 - sheetProgress * 35}%)`,
                  WebkitBackdropFilter: `blur(${glassBlur}px) saturate(${150 - sheetProgress * 35}%)`,
                }
              : undefined
          }
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+0.45rem)] h-1.5 w-10 -translate-x-1/2 rounded-full bg-wit-ink/20 md:hidden"
          />
          <button
            type="button"
            onClick={requestClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wit-ink transition-colors hover:bg-wit-mist/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue"
            aria-label={t("Volver al calendario", "Back to calendar")}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
          </button>
          <div className="min-w-0">
            <h2 id="calendar-entry-detail-title" className="text-base font-extrabold text-wit-ink">
              {t("Detalle de publicación", "Post details")}
            </h2>
            <p className="text-xs font-semibold capitalize text-wit-gray">
              {formatDayLabel(entry.date, t)}
            </p>
          </div>
        </header>

        <div
          ref={dialogRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-7 md:pb-28"
        >
          <div className="pt-4">
            {entry.status === "lista" && entry.format === "video" && entry.deliveredVideoHref ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-wit-ink/5 bg-black">
                <video
                  controls
                  preload="metadata"
                  className="block max-h-[48dvh] w-full object-contain"
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
                  imageClassName="block max-h-[48dvh] w-full object-contain"
                />
              </div>
            ) : (
              <div className="mt-3 flex aspect-square items-center justify-center rounded-2xl border border-wit-ink/5 bg-gradient-to-br from-wit-mist/80 to-white/40">
                <Icon className="h-10 w-10 text-wit-blue/45" strokeWidth={1.6} />
              </div>
            )}
            {previewHref ? (
              <button
                type="button"
                onClick={() => window.open(previewHref, "_blank", "noopener,noreferrer")}
                className="mt-2 text-xs font-bold text-wit-blue hover:text-wit-blue-deep"
              >
                {t("Ampliar vista previa", "Expand preview")}
              </button>
            ) : null}

            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
                className="mt-3.5 w-full rounded-xl border border-wit-ink/15 px-3 py-2 text-lg font-extrabold tracking-tight text-wit-ink outline-none focus:border-wit-blue"
              />
            ) : (
              <h3 className="mt-3.5 text-lg font-extrabold tracking-tight text-wit-ink">
                {entry.title}
              </h3>
            )}

            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wit-mist/50 px-2.5 py-1 text-xs font-bold text-wit-gray">
                <Icon className="h-3 w-3" strokeWidth={2.4} />
                {formatLabel(entry.format, t)}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${publicationMeta.cls}`}>
                {publicationMeta.label}
              </span>
            </div>
            {entry.publicationStatus === "scheduled" && entry.scheduledForUtc ? (
              <p className="mt-2 text-xs font-semibold text-violet-700">
                {new Intl.DateTimeFormat(t("es-MX", "en-US"), {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: entry.publicationTimezone ?? undefined,
                }).format(new Date(`${entry.scheduledForUtc.replace(" ", "T")}Z`))}
                {entry.publicationTimezone ? ` — ${entry.publicationTimezone}` : ""}
              </p>
            ) : null}

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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-wit-gray">
                    {t("Copy para la publicación", "Post copy")}
                  </p>
                  {captionText && !editingCaption ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCaptionDraft(captionText);
                        setEditingCaption(true);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-wit-blue hover:text-wit-blue-deep"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      {t("Editar", "Edit")}
                    </button>
                  ) : null}
                </div>
                {generatingCaption ? (
                  <p className="mt-2 text-sm text-wit-gray">
                    {t("Generando copy...", "Generating copy...")}
                  </p>
                ) : captionText && editingCaption ? (
                  <>
                    <textarea
                      value={captionDraft}
                      onChange={(event) => setCaptionDraft(event.target.value)}
                      rows={8}
                      maxLength={5000}
                      className="mt-2 w-full resize-none rounded-xl border border-wit-ink/15 bg-white px-3 py-2 text-sm leading-relaxed text-wit-ink outline-none focus:border-wit-blue focus:ring-2 focus:ring-wit-blue/15"
                    />
                    <p className="mt-1 text-right text-[11px] font-medium text-wit-gray">
                      {captionDraft.length}/5000
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCaption(false)}
                        disabled={savingCaption}
                        className="min-h-11 flex-1 rounded-full border border-wit-ink/15 bg-white px-3 text-xs font-bold text-wit-ink disabled:opacity-50"
                      >
                        {t("Cancelar", "Cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={saveCaption}
                        disabled={
                          savingCaption ||
                          !captionDraft.trim() ||
                          captionDraft.trim() === captionText
                        }
                        className="min-h-11 flex-1 rounded-full bg-wit-blue px-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {savingCaption
                          ? t("Guardando...", "Saving...")
                          : t("Guardar cambios", "Save changes")}
                      </button>
                    </div>
                  </>
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
                        {captionCopied
                          ? t("Copy copiado", "Copy copied")
                          : t("Copiar texto", "Copy text")}
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
            {editing ? null : (
              <section className="mt-4 rounded-2xl border border-wit-blue/12 bg-wit-blue/[0.025] p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wit-blue/10 text-wit-blue">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-wit-ink">
                      {t("Promocionar esta pieza", "Promote this piece")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-wit-gray">
                      {entry.status !== "lista"
                        ? t(
                            "Esta pieza debe estar terminada y aprobada antes de crear una campaña.",
                            "This piece must be completed and approved before creating a campaign.",
                          )
                        : entry.format !== "imagen" && entry.format !== "video"
                          ? t(
                              "La pauta directa está disponible para piezas de imagen y video.",
                              "Direct advertising is available for image and video pieces.",
                            )
                          : t(
                              "Configura una campaña de Meta en menos de un minuto.",
                              "Set up a Meta campaign in under a minute.",
                            )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={
                    entry.status !== "lista" ||
                    (entry.format !== "imagen" && entry.format !== "video") ||
                    !entry.requestId
                  }
                  onClick={() => setCampaignOpen(true)}
                  className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-wit-blue px-4 text-sm font-bold text-white transition-colors hover:bg-wit-blue-deep disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Megaphone className="h-4 w-4" />
                  {t("Pautar", "Promote")}
                </button>
                {entry.requestId ? <PieceCampaignSummary requestId={entry.requestId} /> : null}
              </section>
            )}
            {editing ? null : <DesignChangeRequest entry={entry} />}

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
        </div>
      </div>
      {campaignOpen && entry.requestId ? (
        <CampaignCreationSheet
          piece={{
            requestId: entry.requestId,
            title: entry.title,
            caption: captionText,
            previewUrl: previewHref,
            format: entry.format,
          }}
          onClose={() => setCampaignOpen(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ["campaign-for-request", entry.requestId] });
            void qc.invalidateQueries({ queryKey: ["campaigns"] });
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}

type PieceCampaign = {
  id: string;
  metaStatus: string;
  dailyBudgetCents: number | null;
  durationDays: number | null;
};

function PieceCampaignSummary({ requestId }: { requestId: string }) {
  const { t } = useLanguage();
  const query = useQuery({
    queryKey: ["campaign-for-request", requestId],
    queryFn: async () => {
      const response = await fetch(
        `/api/campaign-for-request?requestId=${encodeURIComponent(requestId)}`,
        { credentials: "include" },
      );
      return (await response.json()) as { ok: boolean; campaign: PieceCampaign | null };
    },
    staleTime: 30_000,
  });
  const campaign = query.data?.campaign;
  if (!campaign) return null;
  const meta: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: t("Activa", "Active"), cls: "bg-emerald-50 text-emerald-700" },
    PAUSED: { label: t("Pausada", "Paused"), cls: "bg-amber-50 text-amber-700" },
    IN_PROCESS: { label: t("En revisión", "In review"), cls: "bg-blue-50 text-blue-700" },
    WITH_ISSUES: {
      label: t("Requiere atención", "Needs attention"),
      cls: "bg-orange-50 text-orange-700",
    },
    DISAPPROVED: { label: t("Rechazada", "Rejected"), cls: "bg-red-50 text-red-700" },
    COMPLETED: { label: t("Finalizada", "Completed"), cls: "bg-wit-mist/60 text-wit-gray" },
  };
  const status = meta[campaign.metaStatus] ?? {
    label: campaign.metaStatus,
    cls: "bg-wit-mist/60 text-wit-gray",
  };
  return (
    <div className="mt-3 border-t border-wit-ink/7 pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-wit-gray">
          {t("Campaña", "Campaign")}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
          {status.label}
        </span>
      </div>
      <div className="mt-2 flex gap-5 text-xs text-wit-gray">
        {campaign.dailyBudgetCents != null ? (
          <span>
            <b className="text-wit-ink">${(campaign.dailyBudgetCents / 100).toLocaleString()}</b>
            {t("/día", "/day")}
          </span>
        ) : null}
        {campaign.durationDays ? (
          <span>
            <b className="text-wit-ink">{campaign.durationDays}</b> {t("días", "days")}
          </span>
        ) : null}
      </div>
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

function DesignChangeRequest({ entry }: { entry: CalendarEntry }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("Cambiar texto de la imagen");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (entry.status !== "lista" || !entry.requestId) return null;
  async function submit() {
    if (sending || message.trim().length < 5) return;
    setSending(true);
    setError(null);
    const endpoint =
      entry.format === "video"
        ? "/api/video-request-change"
        : entry.format === "carrusel"
          ? "/api/carousel-request-change"
          : "/api/request-change";
    const body =
      entry.format === "video"
        ? { videoRequestId: entry.requestId, message: `${kind}: ${message.trim()}` }
        : entry.format === "carrusel"
          ? { carouselRequestId: entry.requestId, message: `${kind}: ${message.trim()}` }
          : { requestId: entry.requestId, message: `${kind}: ${message.trim()}` };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) throw new Error("change_request_failed");
      setOpen(false);
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
    } catch {
      setError(
        t(
          "No pudimos enviar la solicitud. Intenta de nuevo.",
          "We couldn't send the request. Try again.",
        ),
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="mt-4 rounded-2xl border border-wit-ink/8 bg-white p-3.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-bold text-wit-ink hover:text-wit-blue"
      >
        {t("Solicitar cambio de diseño", "Request a design change")}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-wit-ink/15 bg-white px-3 text-sm text-wit-ink"
          >
            <option>{t("Cambiar texto de la imagen", "Change image text")}</option>
            <option>{t("Cambiar fotografía", "Change photo")}</option>
            <option>{t("Cambiar colores", "Change colors")}</option>
            <option>{t("Corregir información", "Correct information")}</option>
            <option>{t("Otro cambio", "Other change")}</option>
          </select>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            required
            placeholder={t("Describe el cambio que necesitas", "Describe the change you need")}
            className="w-full resize-none rounded-xl border border-wit-ink/15 px-3 py-2 text-sm outline-none focus:border-wit-blue"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || message.trim().length < 5}
            className="min-h-11 rounded-full bg-wit-blue px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {sending ? t("Enviando...", "Sending...") : t("Enviar solicitud", "Send request")}
          </button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

// Tira de "Conexiones" arriba del calendario — Instagram se conecta
// directo con su propia cuenta (sin pasar por Facebook), y Facebook se
// conecta aparte con su Página. Cada ícono manda a su propio flujo de OAuth.
function ConnectionsStrip({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [detailsPlatform, setDetailsPlatform] = useState<SocialPlatform | null>(null);
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
      const message =
        err === "falta_instagram_config"
          ? t(
              "Instagram aún no está configurado. Contacta a soporte para completar la conexión.",
              "Instagram is not configured yet. Contact support to finish the connection.",
            )
          : err === "estado_instagram"
            ? t(
                "La sesión para conectar Instagram expiró. Inténtalo de nuevo.",
                "The Instagram connection session expired. Try again.",
              )
            : err === "intercambio_fallido"
              ? t(
                  "Instagram rechazó la conexión. Revisa los permisos de Meta e inténtalo de nuevo.",
                  "Instagram rejected the connection. Check Meta permissions and try again.",
                )
              : t(
                  "No pudimos conectar la cuenta. Intenta de nuevo.",
                  "We couldn't connect the account. Try again.",
                );
      setNotice(message);
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
    const label = platform === "instagram" ? "Instagram" : "Facebook";
    if (
      !window.confirm(
        t(
          `¿Desconectar ${label}? Podrás volver a conectarlo después.`,
          `Disconnect ${label}? You can reconnect it later.`,
        ),
      )
    ) {
      return;
    }
    const response = await fetch(`/api/social/connections?platform=${platform}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setNotice(
        t(
          "No pudimos desconectar la cuenta. Intenta de nuevo.",
          "We couldn't disconnect the account. Try again.",
        ),
      );
      return;
    }
    setDetailsPlatform(null);
    setNotice(t("Cuenta desconectada.", "Account disconnected."));
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
          onClick={() => setDetailsPlatform(platform)}
          aria-label={t(`Ver información de ${label}`, `View ${label} information`)}
          title={t(`Ver información de ${label}`, `View ${label} information`)}
          className="flex h-11 items-center gap-2 rounded-full border border-wit-ink/10 bg-white px-3 text-xs font-bold text-wit-ink shadow-[0_2px_8px_rgba(5,13,40,0.03)]"
        >
          <PillIcon
            className={
              platform === "instagram" ? "h-4 w-4 text-wit-pink" : "h-4 w-4 text-[#1877f2]"
            }
            strokeWidth={2.2}
          />
          {connection.name ?? label}
          <ChevronDown className="h-3.5 w-3.5 text-wit-gray" strokeWidth={2.2} />
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
        className="flex h-11 items-center gap-2 rounded-full border border-wit-ink/12 bg-white px-3 text-xs font-bold text-wit-gray hover:border-wit-ink/25 hover:text-wit-ink"
      >
        <PillIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
        {t(`Conectar ${label}`, `Connect ${label}`)}
      </a>
    );
  }

  // These two channels are deliberately visible before their OAuth flows
  // exist. A disabled button would look broken; this answers the tap with a
  // clear status while keeping the exact same compact connection area that
  // will later host their real authorization actions.
  function UpcomingPill({ icon: PillIcon, label }: { icon: typeof Instagram; label: string }) {
    return (
      <button
        type="button"
        onClick={() =>
          setNotice(
            t(
              `${label} estará disponible próximamente. Estamos preparando su conexión segura.`,
              `${label} will be available soon. We're preparing its secure connection.`,
            ),
          )
        }
        aria-label={t(`Información sobre ${label}`, `Information about ${label}`)}
        className="flex h-11 items-center gap-2 rounded-full border border-dashed border-wit-ink/15 bg-wit-mist/25 px-3 text-xs font-bold text-wit-gray transition hover:border-wit-blue/35 hover:bg-wit-blue/[0.035] hover:text-wit-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue"
      >
        <PillIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
        {label}
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-wit-blue">
          {t("Próximamente", "Soon")}
        </span>
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Pill icon={Instagram} label="Instagram" platform="instagram" />
      <Pill icon={Facebook} label="Facebook" platform="facebook" />
      <UpcomingPill icon={Music2} label="TikTok" />
      <UpcomingPill icon={Youtube} label="YouTube" />
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
      {detailsPlatform && connections[detailsPlatform] ? (
        <div
          className="fixed inset-0 z-[75] flex items-end bg-wit-ink/15 p-4 backdrop-blur-[2px] sm:items-center sm:justify-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsPlatform(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="social-account-title"
            className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,40,0.18)] sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {detailsPlatform === "instagram" ? (
                  <Instagram className="h-6 w-6 text-wit-pink" strokeWidth={2.2} />
                ) : (
                  <Facebook className="h-6 w-6 text-[#1877f2]" strokeWidth={2.2} />
                )}
                <div>
                  <h3 id="social-account-title" className="text-base font-extrabold text-wit-ink">
                    {detailsPlatform === "instagram" ? "Instagram" : "Facebook"}
                  </h3>
                  <p className="mt-0.5 text-sm font-semibold text-wit-gray">
                    {connections[detailsPlatform]?.name ??
                      (detailsPlatform === "instagram" ? "Instagram" : "Facebook")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsPlatform(null)}
                aria-label={t("Cerrar", "Close")}
                className="grid h-11 w-11 place-items-center rounded-full text-wit-gray transition hover:bg-wit-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-wit-bg px-4 py-3">
              <p className="text-sm font-bold text-wit-ink">
                {t("Cuenta conectada", "Connected account")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-wit-gray">
                {t(
                  "Esta cuenta se usará cuando selecciones esta red para publicar contenido.",
                  "This account will be used when you choose this network to publish content.",
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void disconnect(detailsPlatform)}
              className="mt-4 w-full rounded-full border border-red-200 px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {t("Desconectar cuenta", "Disconnect account")}
            </button>
          </section>
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const { data: connections = EMPTY_CONNECTIONS } = useQuery({
    queryKey: ["social-connections"],
    queryFn: fetchConnections,
  });
  const videoPublicationsQuery = useQuery({
    queryKey: ["calendar-entry-video-publications", entry.id],
    enabled: entry.status === "lista" && entry.format === "video",
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar-entries-publish?entryId=${encodeURIComponent(entry.id)}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        videoPublications?: {
          platform: SocialPlatform;
          status: "processing" | "success" | "error";
          error: string | null;
          created_at: string;
        }[];
      };
      return data.ok ? (data.videoPublications ?? []) : [];
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
    if (
      !window.confirm(
        t(
          `¿Publicar ahora en ${Array.from(selected).map(platformLabel).join(" y ")}?`,
          `Publish now to ${Array.from(selected).map(platformLabel).join(" and ")}?`,
        ),
      )
    )
      return;
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

  async function schedule() {
    if (selected.size === 0 || !scheduleValue || scheduling) return;
    const date = new Date(scheduleValue);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setPublishError(t("Elige una fecha y hora futuras.", "Choose a future date and time."));
      return;
    }
    setScheduling(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/calendar-entries-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          scheduledForUtc: date.toISOString(),
          timezone,
          platforms: Array.from(selected),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
      setScheduleOpen(false);
      setPublishNotice(t("Publicación programada", "Post scheduled"));
      void queryClient.invalidateQueries({ queryKey: ["calendar-entries"] });
    } catch {
      setPublishError(t("No pudimos programar la publicación.", "We couldn't schedule the post."));
    } finally {
      setScheduling(false);
    }
  }

  async function cancelSchedule() {
    if (!window.confirm(t("¿Cancelar esta programación?", "Cancel this schedule?"))) return;
    const res = await fetch(
      `/api/calendar-entries-schedule?entryId=${encodeURIComponent(entry.id)}`,
      {
        method: "DELETE",
      },
    );
    if (res.ok) void queryClient.invalidateQueries({ queryKey: ["calendar-entries"] });
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
          <p className="mt-3 text-sm font-bold text-wit-ink">
            {t("¿Dónde quieres publicar?", "Where do you want to publish?")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["instagram", "facebook"] as SocialPlatform[]).map((platform) => {
              const connected = Boolean(connections[platform]);
              return (
                <label
                  key={platform}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${connected ? "text-wit-ink" : "cursor-not-allowed bg-wit-mist/35 text-wit-gray"} ${selected.has(platform) ? "border-wit-blue bg-wit-blue/5" : "border-wit-ink/12 bg-white"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(platform)}
                    onChange={() => toggle(platform)}
                    disabled={!connected}
                    className="h-4 w-4 rounded border-wit-ink/25"
                  />
                  <span>{platform === "instagram" ? "Instagram" : "Facebook"}</span>
                  <span className="max-w-24 truncate text-xs font-medium text-wit-gray">
                    {connections[platform]?.name ?? t("No conectada", "Not connected")}
                  </span>
                </label>
              );
            })}
          </div>
          {entry.publicationStatus === "scheduled" ? (
            <button
              type="button"
              onClick={cancelSchedule}
              className="mt-3 text-xs font-bold text-red-600 hover:underline"
            >
              {t("Cancelar programación", "Cancel schedule")}
            </button>
          ) : null}
          {scheduleOpen ? (
            <div className="mt-3 rounded-2xl border border-wit-blue/15 bg-white p-3">
              <label className="text-xs font-bold text-wit-ink" htmlFor={`schedule-${entry.id}`}>
                {t("Fecha y hora", "Date and time")}
              </label>
              <input
                id={`schedule-${entry.id}`}
                type="datetime-local"
                value={scheduleValue}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                onChange={(event) => setScheduleValue(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-wit-ink/15 px-3 text-sm"
              />
              <p className="mt-2 text-xs text-wit-gray">
                {t(`Zona horaria: ${timezone}`, `Time zone: ${timezone}`)}
              </p>
              <p className="mt-1 text-xs font-medium text-wit-gray">
                {Array.from(selected).map(platformLabel).join(" · ")}
              </p>
              <button
                type="button"
                onClick={schedule}
                disabled={scheduling || !scheduleValue || selected.size === 0}
                className="mt-3 min-h-11 rounded-full bg-wit-blue px-4 text-xs font-bold text-white disabled:opacity-50"
              >
                {scheduling
                  ? t("Programando...", "Scheduling...")
                  : t("Confirmar programación", "Confirm schedule")}
              </button>
            </div>
          ) : null}
          <div className="sticky bottom-0 z-10 -mx-3.5 mt-4 flex flex-col gap-2 border-t border-wit-ink/8 bg-white/95 px-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:flex-row">
            <button
              type="button"
              disabled={selected.size === 0 || publishing || scheduling}
              onClick={() => setScheduleOpen((value) => !value)}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-wit-blue bg-white px-4 text-sm font-bold text-wit-blue shadow-sm transition-colors hover:bg-wit-blue/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue disabled:opacity-50"
            >
              <CalendarClock className="h-4 w-4" />
              {t("Programar", "Schedule")}
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || publishing || scheduling}
              onClick={publish}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-wit-pink via-[#775cff] to-wit-blue px-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(119,92,255,0.22)] transition-transform hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {publishing
                ? t("Publicando...", "Publishing...")
                : t("Publicar ahora", "Publish now")}
            </button>
          </div>
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

type MonthlyScheduleItem = {
  entry: CalendarEntry;
  plannedDate: string;
  time: string;
  at: Date;
  platforms: SocialPlatform[];
  reprogrammed: boolean;
};

function dateKeyInTimezone(timezone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function scheduledDateTime(plannedDate: string, time: string): Date {
  return new Date(`${plannedDate}T${time}:00`);
}

function MonthlyProgrammingSheet({
  entries,
  year,
  month,
  monthLabel,
  scheduledCount,
  onClose,
}: {
  entries: CalendarEntry[];
  year: number;
  month: number;
  monthLabel: string;
  scheduledCount: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = dateKeyInTimezone(timezone);
  const isFutureScheduled = (entry: CalendarEntry) =>
    entry.publicationStatus === "scheduled" &&
    Boolean(entry.scheduledForUtc) &&
    Date.parse(`${entry.scheduledForUtc!.replace(" ", "T")}Z`) > Date.now();
  const isExpired = (entry: CalendarEntry) =>
    !isFutureScheduled(entry) &&
    entry.publicationStatus !== "published" &&
    entry.publicationStatus !== "partial" &&
    entry.date < today;
  const publishable = entries.filter(
    (entry) =>
      entry.status === "lista" &&
      !isFutureScheduled(entry) &&
      entry.publicationStatus !== "published",
  );
  const expiredEntries = publishable.filter(isExpired);
  const pendingEntries = publishable.filter((entry) => !isExpired(entry));
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(publishable.map((entry) => entry.id)),
  );
  const [defaultTime, setDefaultTime] = useState("18:00");
  const [useDefaultTime, setUseDefaultTime] = useState(true);
  const [timeOverrides, setTimeOverrides] = useState<Record<string, string>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  // Kept while the old visual markup below remains in the source; the new
  // monthly flow never reads these values or redistributes calendar dates.
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(
    new Set(["instagram", "facebook"]),
  );
  const [plans, setPlans] = useState<MonthlyScheduleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: MonthlyScheduleItem[] } | null>(null);
  const { data: connections = EMPTY_CONNECTIONS } = useQuery({
    queryKey: ["social-connections"],
    queryFn: fetchConnections,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  function toggleSelected(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function continueToPreview() {
    const chosen = publishable.filter((entry) => selected.has(entry.id));
    const activePlatforms = (["instagram", "facebook"] as SocialPlatform[]).filter(
      (platform) => platforms.has(platform) && connections[platform],
    );
    if (!chosen.length)
      return setError(t("Selecciona al menos una pieza.", "Select at least one piece."));
    if (!activePlatforms.length)
      return setError(t("Selecciona una red conectada.", "Select a connected network."));
    const nextPlans = chosen.map((entry) => {
      const plannedDate = dateOverrides[entry.id] ?? entry.date;
      const time = timeOverrides[entry.id] ?? defaultTime;
      return {
        entry,
        plannedDate,
        time,
        at: scheduledDateTime(plannedDate, time),
        platforms:
          entry.publicationPlatforms?.filter((platform) => connections[platform]) ??
          activePlatforms,
        reprogrammed: plannedDate !== entry.date,
      };
    });
    if (nextPlans.some((plan) => isExpired(plan.entry) && !dateOverrides[plan.entry.id])) {
      return setError(
        t(
          "Reprograma las publicaciones con fecha vencida para continuar.",
          "Reschedule expired posts to continue.",
        ),
      );
    }
    if (nextPlans.some((plan) => !Number.isFinite(plan.at.getTime()) || plan.at <= new Date())) {
      return setError(
        t(
          "Todas las fechas y horarios deben ser futuros.",
          "All dates and times must be in the future.",
        ),
      );
    }
    const conflicts = new Set<string>();
    for (const plan of nextPlans) {
      for (const platform of plan.platforms) {
        const key = `${plan.at.toISOString()}-${platform}`;
        if (conflicts.has(key))
          return setError(
            t(
              "Dos piezas tienen el mismo horario y red. Ajusta una hora.",
              "Two pieces have the same time and network. Adjust one time.",
            ),
          );
        conflicts.add(key);
      }
    }
    setError(null);
    setPlans(nextPlans);
    setStep(3);
  }
  async function confirm() {
    if (saving) return;
    setSaving(true);
    const failed: MonthlyScheduleItem[] = [];
    let ok = 0;
    for (const plan of plans) {
      try {
        const response = await fetch("/api/calendar-entries-schedule", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entryId: plan.entry.id,
            scheduledForUtc: plan.at.toISOString(),
            timezone,
            platforms: plan.platforms,
            plannedDate: plan.reprogrammed ? plan.plannedDate : undefined,
          }),
        });
        const data = (await response.json()) as { ok: boolean };
        if (!response.ok || !data.ok) failed.push(plan);
        else ok += 1;
      } catch {
        failed.push(plan);
      }
    }
    await qc.invalidateQueries({ queryKey: ["calendar-entries"] });
    setResult({ ok, failed });
    setSaving(false);
    setStep(4);
  }
  const stepLabel = [
    "",
    t("Selecciona el contenido", "Select content"),
    t("Define tus horarios", "Set your times"),
    t("Revisar programación", "Review schedule"),
  ];
  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-wit-ink/15 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("Programa tu contenido del mes", "Schedule your month's content")}
        className="absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-[30px] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_40px_rgba(5,13,40,0.14)] md:inset-x-4 md:top-[5vh] md:mx-auto md:max-w-2xl md:rounded-3xl md:pb-6"
      >
        <span
          aria-hidden="true"
          className="mx-auto h-1.5 w-10 rounded-full bg-wit-ink/20 md:hidden"
        />
        <header className="mt-3 flex items-center justify-between gap-3">
          <div>
            {step > 0 && step < 4 ? (
              <p className="text-xs font-bold text-wit-blue">1&nbsp;&nbsp;2&nbsp;&nbsp;3</p>
            ) : null}
            <h2 className="text-lg font-extrabold text-wit-ink">
              {step === 0
                ? t("Programa tu contenido del mes", "Schedule your month's content")
                : step === 4
                  ? t("¡Todo listo! 🎉", "All set! 🎉")
                  : stepLabel[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist"
            aria-label={t("Cerrar", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-5">
          {step === 0 ? (
            <div>
              <h3 className="text-center text-xl font-extrabold text-wit-ink">
                {t("Deja listo tu contenido del mes", "Get your month's content ready")}
              </h3>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-wit-pink/10 text-wit-pink">
                <CalendarClock className="h-7 w-7" />
              </div>
              <p className="mt-4 text-center text-sm leading-relaxed text-wit-gray">
                {t(
                  "Tus piezas ya tienen una fecha asignada. Elige cuáles quieres dejar programadas y nosotros nos encargamos de publicarlas.",
                  "Your pieces already have a date. Choose which ones to automate and we'll publish them.",
                )}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-violet-50 p-3">
                  <b className="block text-xl text-violet-700">{scheduledCount}</b>
                  <span className="text-[11px] font-semibold text-violet-700">
                    {t("Programadas", "Scheduled")}
                  </span>
                </div>
                <div className="rounded-2xl bg-wit-pink/10 p-3">
                  <b className="block text-xl text-wit-pink">{pendingEntries.length}</b>
                  <span className="text-[11px] font-semibold text-wit-gray">
                    {t("Por programar", "To schedule")}
                  </span>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3">
                  <b className="block text-xl text-amber-700">{expiredEntries.length}</b>
                  <span className="text-[11px] font-semibold text-amber-700">
                    {t("Fecha vencida", "Expired")}
                  </span>
                </div>
              </div>
              <div className="mt-5 space-y-3 rounded-2xl bg-wit-mist/25 p-4 text-xs text-wit-gray">
                <p>
                  <b className="text-wit-ink">
                    {t("Fechas ya planeadas", "Dates already planned")}
                  </b>
                  <br />
                  {t(
                    "Las fechas fueron definidas en tu calendario.",
                    "Dates were defined in your calendar.",
                  )}
                </p>
                <p>
                  <b className="text-wit-ink">{t("Tú eliges la hora", "You choose the time")}</b>
                  <br />
                  {t(
                    "Selecciona el horario en que publicaremos.",
                    "Choose the time we will publish.",
                  )}
                </p>
                <p>
                  <b className="text-wit-ink">{t("Publicamos por ti", "We publish for you")}</b>
                  <br />
                  {t(
                    "Nos encargamos de publicar automáticamente en las redes que elijas.",
                    "We'll publish automatically to the networks you choose.",
                  )}
                </p>
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="space-y-2">
              <p className="text-sm text-wit-gray">
                {t(
                  "Elige las piezas que quieres dejar programadas.",
                  "Choose the pieces you want to schedule.",
                )}
              </p>
              {expiredEntries.length ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {t(
                    `${expiredEntries.length} publicaciones tienen la fecha vencida. Podrás asignarles una nueva fecha antes de programarlas.`,
                    `${expiredEntries.length} posts have expired dates. You can assign a new date before scheduling.`,
                  )}
                </p>
              ) : null}
              <label className="flex items-center justify-between rounded-xl bg-wit-mist/30 px-3 py-3 text-sm font-bold text-wit-ink">
                <span>
                  {t(
                    `Seleccionar todo (${publishable.length})`,
                    `Select all (${publishable.length})`,
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={selected.size === publishable.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(publishable.map((item) => item.id))
                        : new Set(),
                    )
                  }
                />
              </label>
              {publishable.map((entry) => {
                const Icon = FORMAT_ICON[entry.format];
                const expired = isExpired(entry);
                return (
                  <label
                    key={entry.id}
                    className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-3 ${expired ? "border-amber-200 bg-amber-50/50" : "border-wit-ink/7"}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-wit-mist/40">
                      {entry.thumbHref ? (
                        <img src={entry.thumbHref} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-5 w-5 text-wit-blue" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm text-wit-ink">{entry.title}</b>
                      <span className="block text-xs text-wit-gray">
                        {formatLabel(entry.format, t)} · 📅{" "}
                        {new Intl.DateTimeFormat(t("es-MX", "en-US"), {
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        }).format(new Date(`${entry.date}T00:00:00Z`))}
                        {expired ? ` · ${t("Fecha vencida", "Expired")}` : ""}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                    />
                  </label>
                );
              })}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-wit-gray">
                {t(
                  "Mantendremos las fechas planeadas. Solo elige a qué hora quieres publicar.",
                  "We'll keep planned dates. Just choose what time to publish.",
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {["10:00", "13:00", "18:00"].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setDefaultTime(time)}
                    className={`min-h-11 rounded-xl border text-sm font-bold ${defaultTime === time ? "border-wit-pink bg-wit-pink/10 text-wit-pink" : "border-wit-ink/10 text-wit-gray"}`}
                  >
                    {new Date(`2000-01-01T${time}:00`).toLocaleTimeString(t("es-MX", "en-US"), {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
                <label className="flex min-h-11 items-center justify-center rounded-xl border border-wit-ink/10 text-sm font-bold text-wit-gray">
                  {t("Elegir otro", "Choose another")}
                  <input
                    type="time"
                    value={defaultTime}
                    onChange={(event) => setDefaultTime(event.target.value)}
                    className="ml-2 w-20 bg-transparent"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-wit-ink">
                <input
                  type="checkbox"
                  checked={useDefaultTime}
                  onChange={(event) => setUseDefaultTime(event.target.checked)}
                />
                {t("Usar este horario para todas", "Use this time for all")}
              </label>
              <div className="rounded-2xl border border-wit-ink/8 p-3">
                <p className="text-sm font-bold text-wit-ink">
                  {t("Redes donde publicar", "Networks to publish")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["instagram", "facebook"] as SocialPlatform[])
                    .filter((platform) => connections[platform])
                    .map((platform) => (
                      <label
                        key={platform}
                        className="rounded-full border border-wit-ink/10 px-3 py-2 text-xs font-bold text-wit-ink"
                      >
                        <input
                          type="checkbox"
                          checked={platforms.has(platform)}
                          onChange={() =>
                            setPlatforms((current) => {
                              const next = new Set(current);
                              if (next.has(platform)) next.delete(platform);
                              else next.add(platform);
                              return next;
                            })
                          }
                        />{" "}
                        {platform === "instagram" ? "Instagram" : "Facebook"} ·{" "}
                        {connections[platform]?.name}
                      </label>
                    ))}
                </div>
              </div>
              {expiredEntries.filter((entry) => selected.has(entry.id)).length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-sm font-bold text-amber-800">
                    {t(
                      `Publicaciones con fecha vencida (${expiredEntries.filter((entry) => selected.has(entry.id)).length})`,
                      `Expired posts (${expiredEntries.filter((entry) => selected.has(entry.id)).length})`,
                    )}
                  </p>
                  {expiredEntries
                    .filter((entry) => selected.has(entry.id))
                    .map((entry) => (
                      <div key={entry.id} className="mt-3 border-t border-amber-200 pt-3">
                        <b className="block text-sm text-wit-ink">{entry.title}</b>
                        <span className="text-xs text-amber-800">
                          {t(`Fecha anterior: ${entry.date}`, `Previous date: ${entry.date}`)}
                        </span>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            min={today}
                            value={dateOverrides[entry.id] ?? ""}
                            onChange={(event) =>
                              setDateOverrides((value) => ({
                                ...value,
                                [entry.id]: event.target.value,
                              }))
                            }
                            className="min-h-10 rounded-lg border border-amber-200 bg-white px-2 text-xs"
                          />
                          <input
                            type="time"
                            value={timeOverrides[entry.id] ?? defaultTime}
                            onChange={(event) =>
                              setTimeOverrides((value) => ({
                                ...value,
                                [entry.id]: event.target.value,
                              }))
                            }
                            className="min-h-10 rounded-lg border border-amber-200 bg-white px-2 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
              {!useDefaultTime ? (
                <div className="space-y-2">
                  {publishable
                    .filter((entry) => selected.has(entry.id) && !isExpired(entry))
                    .map((entry) => (
                      <label
                        key={entry.id}
                        className="flex items-center justify-between rounded-xl bg-wit-mist/25 px-3 py-2 text-sm font-semibold text-wit-ink"
                      >
                        <span className="truncate pr-3">{entry.title}</span>
                        <input
                          type="time"
                          value={timeOverrides[entry.id] ?? defaultTime}
                          onChange={(event) =>
                            setTimeOverrides((value) => ({
                              ...value,
                              [entry.id]: event.target.value,
                            }))
                          }
                          className="w-24 bg-transparent text-xs"
                        />
                      </label>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="hidden">
            {step === 0 ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-wit-pink/10 text-wit-pink">
                  <CalendarClock className="h-8 w-8" />
                </div>
                <p className="mt-4 text-center text-sm leading-relaxed text-wit-gray">
                  {t(
                    "Organiza todas tus publicaciones del mes en minutos y nosotros nos encargamos del resto.",
                    "Organize all of your month's posts in minutes and we'll handle the rest.",
                  )}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-wit-mist/35 p-4 text-center">
                    <b className="block text-xl text-wit-ink">{scheduledCount}</b>
                    <span className="text-xs text-wit-gray">
                      {t("Ya programadas", "Already scheduled")}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-wit-pink/8 p-4 text-center">
                    <b className="block text-xl text-wit-ink">{publishable.length}</b>
                    <span className="text-xs text-wit-gray">{t("Pendientes", "Pending")}</span>
                  </div>
                </div>
              </>
            ) : null}
            {step === 1 ? (
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-xl bg-wit-mist/30 px-3 py-3 text-sm font-bold text-wit-ink">
                  <span>
                    {t(
                      `Seleccionar todo (${publishable.length})`,
                      `Select all (${publishable.length})`,
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.size === publishable.length}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? new Set(publishable.map((item) => item.id))
                          : new Set(),
                      )
                    }
                  />
                </label>
                {publishable.map((entry) => {
                  const Icon = FORMAT_ICON[entry.format];
                  return (
                    <label
                      key={entry.id}
                      className="flex min-h-16 items-center gap-3 rounded-2xl border border-wit-ink/7 px-3"
                    >
                      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-wit-mist/40">
                        {entry.thumbHref ? (
                          <img
                            src={entry.thumbHref}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Icon className="h-5 w-5 text-wit-blue" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm text-wit-ink">{entry.title}</b>
                        <span className="text-xs text-wit-gray">
                          {formatLabel(entry.format, t)}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={selected.has(entry.id)}
                        onChange={() => toggleSelected(entry.id)}
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
            {step === 2 ? (
              <div>
                <p className="text-sm font-bold text-wit-ink">
                  {t("Días de publicación", "Publishing days")}
                </p>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {[
                    [1, "Lun"],
                    [2, "Mar"],
                    [3, "Mié"],
                    [4, "Jue"],
                    [5, "Vie"],
                    [6, "Sáb"],
                    [0, "Dom"],
                  ].map(([value, label]) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() =>
                        setWeekdays((current) =>
                          current.includes(Number(value))
                            ? current.filter((day) => day !== Number(value))
                            : [...current, Number(value)],
                        )
                      }
                      className={`min-h-11 rounded-xl text-xs font-bold ${weekdays.includes(Number(value)) ? "wit-brand-gradient text-white" : "bg-wit-mist/40 text-wit-gray"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-6 text-sm font-bold text-wit-ink">
                  {t("Horarios de publicación", "Publishing times")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {times.map((time, index) => (
                    <label
                      key={`${time}-${index}`}
                      className="rounded-xl border border-wit-blue/20 bg-wit-blue/5 px-3 py-2 text-sm font-bold text-wit-blue"
                    >
                      <input
                        type="time"
                        value={time}
                        onChange={(event) =>
                          setTimes((current) =>
                            current.map((item, i) => (i === index ? event.target.value : item)),
                          )
                        }
                        className="bg-transparent"
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTimes((current) => [...current, "14:00"])}
                    className="rounded-xl border border-dashed border-wit-ink/20 px-3 py-2 text-sm font-bold text-wit-gray"
                  >
                    + {t("Agregar horario", "Add time")}
                  </button>
                </div>
                <p className="mt-6 text-sm font-bold text-wit-ink">
                  {t("Redes sociales", "Social networks")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["instagram", "facebook"] as SocialPlatform[]).map((platform) => (
                    <label
                      key={platform}
                      className={`rounded-full border px-3 py-2 text-xs font-bold ${connections[platform] ? "border-wit-ink/10 text-wit-ink" : "opacity-40"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!connections[platform]}
                        checked={platforms.has(platform)}
                        onChange={() =>
                          setPlatforms((current) => {
                            const next = new Set(current);
                            if (next.has(platform)) next.delete(platform);
                            else next.add(platform);
                            return next;
                          })
                        }
                      />{" "}
                      {platform === "instagram" ? "Instagram" : "Facebook"} ·{" "}
                      {connections[platform]?.name ?? t("Sin conectar", "Not connected")}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {step === 3 ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-wit-ink">
                {t("Revisar programación", "Review schedule")}
              </p>
              {plans.slice(0, 40).map((plan) => (
                <div
                  key={plan.entry.id}
                  className="flex items-center gap-3 rounded-xl bg-wit-mist/25 p-3"
                >
                  <span className="w-24 shrink-0 text-xs font-bold text-wit-blue">
                    {plan.at.toLocaleDateString(t("es-MX", "en-US"), {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    <br />
                    {plan.at.toLocaleTimeString(t("es-MX", "en-US"), {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-wit-ink">
                      {plan.entry.title}
                    </span>
                    <span className="text-xs text-wit-gray">
                      {plan.platforms
                        .map((platform) => (platform === "instagram" ? "Instagram" : "Facebook"))
                        .join(" · ")}
                      {plan.reprogrammed ? ` · ${t("Fecha actualizada", "Date updated")}` : ""}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {step === 4 && result ? (
            <div className="text-center">
              <p className="mt-8 text-sm text-wit-gray">
                {result.failed.length
                  ? t(
                      `${result.ok} piezas programadas; ${result.failed.length} necesitan atención.`,
                      `${result.ok} pieces scheduled; ${result.failed.length} need attention.`,
                    )
                  : t(
                      `Has programado ${result.ok} piezas para ${monthLabel}.`,
                      `You scheduled ${result.ok} pieces for ${monthLabel}.`,
                    )}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <b className="block text-xl text-emerald-700">{result.ok}</b>
                  <span className="text-xs text-emerald-700">{t("Programadas", "Scheduled")}</span>
                </div>
                <div className="rounded-2xl bg-wit-mist/35 p-4">
                  <b className="block text-xl text-wit-ink">
                    {plans.length ? `${plans[0]?.at.getDate()}–${plans.at(-1)?.at.getDate()}` : "—"}
                  </b>
                  <span className="text-xs text-wit-gray">{t("Fechas", "Dates")}</span>
                </div>
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
        </div>
        <footer className="pt-2">
          {step === 0 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="wit-brand-gradient min-h-[52px] w-full rounded-full text-sm font-extrabold text-white"
            >
              {t("Revisar y programar", "Review and schedule")}
            </button>
          ) : step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selected.size}
              className="wit-brand-gradient min-h-[52px] w-full rounded-full text-sm font-extrabold text-white disabled:opacity-50"
            >
              {t("Continuar", "Continue")}
            </button>
          ) : step === 2 ? (
            <button
              type="button"
              onClick={continueToPreview}
              className="wit-brand-gradient min-h-[52px] w-full rounded-full text-sm font-extrabold text-white"
            >
              {t("Revisar programación", "Review schedule")}
            </button>
          ) : step === 3 ? (
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="wit-brand-gradient min-h-[52px] w-full rounded-full text-sm font-extrabold text-white disabled:opacity-50"
            >
              {saving
                ? t("Programando contenido...", "Scheduling content...")
                : t("Confirmar programación", "Confirm scheduling")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="wit-brand-gradient min-h-[52px] w-full rounded-full text-sm font-extrabold text-white"
            >
              {t("Ver calendario", "View calendar")}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function PlanificacionPanel({
  streakWeeks,
  homeMobile = false,
  onViewPlanning,
}: {
  streakWeeks: number;
  homeMobile?: boolean;
  onViewPlanning?: () => void;
}) {
  const { t } = useLanguage();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openBrandMindFromHeader, setOpenBrandMindFromHeader] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [confirmingReplan, setConfirmingReplan] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [monthlyProgrammingOpen, setMonthlyProgrammingOpen] = useState(false);
  const [downloadingPlan, setDownloadingPlan] = useState(false);
  const qc = useQueryClient();

  const base = new Date();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const monthParts = new Intl.DateTimeFormat(t("es-MX", "en-US"), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(target);
  const monthName = monthParts.find((part) => part.type === "month")?.value ?? "";
  const monthYear = monthParts.find((part) => part.type === "year")?.value ?? "";
  const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${monthYear}`;
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
    setSelectedId((prev) => (prev && entries.some((entry) => entry.id === prev) ? prev : null));
    // A piece opens only from its calendar control, never automatically on
    // month load. The mounted calendar therefore keeps its scroll/selection
    // behind the modal until the client explicitly closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.id).join(",")]);

  useEffect(() => {
    if (!entries.length) return;
    const params = new URLSearchParams(window.location.search);
    const campaignEntryId = params.get("campaign_entry");
    if (
      params.get("campaign") === "1" &&
      campaignEntryId &&
      entries.some((entry) => entry.id === campaignEntryId)
    ) {
      setSelectedId(campaignEntryId);
    }
  }, [entries]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const requestedCount = entries.filter((e) => e.status !== "por_planear").length;
  const pendingCount = entries.length - requestedCount;
  const publishableEntries = entries.filter((entry) => entry.status === "lista");
  const planningToday = dateKeyInTimezone(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const hasFutureSchedule = (entry: CalendarEntry) =>
    entry.publicationStatus === "scheduled" &&
    Boolean(entry.scheduledForUtc) &&
    Date.parse(`${entry.scheduledForUtc!.replace(" ", "T")}Z`) > Date.now();
  const monthlyScheduledCount = publishableEntries.filter((entry) =>
    hasFutureSchedule(entry),
  ).length;
  const monthlyExpiredCount = publishableEntries.filter(
    (entry) =>
      !hasFutureSchedule(entry) &&
      entry.publicationStatus !== "published" &&
      entry.publicationStatus !== "partial" &&
      entry.date < planningToday,
  ).length;
  const monthlyPendingCount =
    publishableEntries.length - monthlyScheduledCount - monthlyExpiredCount;
  const monthlyProgressPct = publishableEntries.length
    ? Math.round((monthlyScheduledCount / publishableEntries.length) * 100)
    : 0;
  const grid = buildMonthGrid(year, month);

  async function downloadPlanningPdf() {
    if (!entries.length || downloadingPlan) return;
    setDownloadingPlan(true);
    try {
      const bytes = buildCalendarPlanPdf({ monthLabel, entries });
      downloadPdf(bytes, `planificacion-${year}-${String(month).padStart(2, "0")}.pdf`);
    } finally {
      setDownloadingPlan(false);
    }
  }

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
      {homeMobile ? (
        <section className="rounded-[24px] border border-[rgba(10,30,80,0.06)] bg-white p-5 shadow-[0_8px_28px_rgba(10,30,80,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-wit-blue/[0.08] text-wit-blue">
                <Calendar className="h-5 w-5" strokeWidth={2.3} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight text-wit-ink">{t("Planificación", "Planning")}</h2>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold ${entries.length ? "bg-emerald-50 text-emerald-700" : "bg-wit-blue/[0.07] text-wit-blue"}`}>
                  <span>{entries.length ? "✓" : "•"}</span>
                  {entries.length ? t("Planificación completa", "Planning complete") : t("Lista para planificar", "Ready to plan")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenBrandMindFromHeader(true);
                setWizardOpen(true);
              }}
              aria-label={t("Mente de marca", "Brand mind")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wit-blue/[0.06] text-wit-blue transition-colors hover:bg-wit-blue/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue"
            >
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
          </div>
          <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-wit-gray">
            {entries.length
              ? t("Tu contenido y calendario están listos para este mes.", "Your content and calendar are ready for this month.")
              : t("Cuéntale a Wit qué quieres lograr este mes.", "Tell Wit what you want to achieve this month.")}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 max-[340px]:grid-cols-1">
            <button
              type="button"
              disabled={replanning}
              onClick={() => (entries.length > 0 ? setConfirmingReplan(true) : setWizardOpen(true))}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-[17px] bg-wit-blue px-3 text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(0,71,255,0.18)] transition hover:bg-wit-blue-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
              {replanning ? t("Cargando...", "Loading...") : entries.length ? t("Replanear mes", "Replan month") : t("Planificar mes", "Plan month")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (onViewPlanning) onViewPlanning();
                else document.getElementById("calendario-planificacion")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex min-h-[54px] items-center justify-center gap-1.5 rounded-[17px] border border-wit-blue/20 bg-white px-3 text-sm font-extrabold text-wit-blue transition hover:bg-wit-blue/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2"
            >
              {t("Ver planificación", "View plan")}
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </section>
      ) : null}
      <div className={`${homeMobile ? "hidden" : "flex"} flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tighter text-wit-ink sm:text-3xl">
            {t("Planificación", "Planning")}
          </h1>
          <button
            type="button"
            onClick={() => {
              setOpenBrandMindFromHeader(true);
              setWizardOpen(true);
            }}
            aria-label={t("Mente de marca", "Brand mind")}
            title={t("Mente de marca", "Brand mind")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-wit-blue/[0.06] text-wit-blue transition-colors hover:bg-wit-blue/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2 md:hidden"
          >
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={() => document.getElementById("calendario-planificacion")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex min-h-11 items-center justify-center px-3 py-2 text-sm font-bold text-wit-blue hover:underline"
            >
              {t("Ver planificación completa", "View full plan")}
            </button>
          ) : null}
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={downloadPlanningPdf}
              disabled={downloadingPlan}
              className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-wit-blue transition-colors hover:bg-wit-blue/[0.06] disabled:opacity-60"
            >
              <Download className="h-4 w-4" strokeWidth={2.3} />
              {downloadingPlan ? t("Generando PDF...", "Creating PDF...") : t("Descargar planificación", "Download plan")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpenBrandMindFromHeader(true);
              setWizardOpen(true);
            }}
            className="hidden min-h-11 items-center justify-center gap-2 rounded-full border border-wit-blue/15 bg-wit-blue/[0.05] px-4 py-2.5 text-sm font-bold text-wit-blue transition-colors hover:bg-wit-blue/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2 md:flex"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
            {t("Mente de marca", "Brand mind")}
          </button>
          <button
            type="button"
            disabled={replanning}
            onClick={() => (entries.length > 0 ? setConfirmingReplan(true) : setWizardOpen(true))}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-wit-blue px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(0,71,255,0.18)] transition-all hover:bg-wit-blue-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-11 md:w-auto"
          >
            {entries.length > 0 ? (
              <RotateCcw className="h-[17px] w-[17px]" strokeWidth={2.5} />
            ) : (
              <span className="text-lg leading-none">+</span>
            )}
            {replanning
              ? t("Cargando...", "Loading...")
              : entries.length > 0
                ? t("Replanear mes", "Replan month")
                : t("Planificar contenido", "Plan content")}
          </button>
        </div>
      </div>
      <div className={`${homeMobile ? "mt-6" : "mt-4"} flex flex-wrap items-center gap-2`}>
        <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-white/75 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label={t("Mes anterior", "Previous month")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-wit-gray transition-colors hover:bg-wit-mist/60 hover:text-wit-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <span className="flex min-w-0 items-center gap-1.5 px-0.5 text-sm font-extrabold text-wit-ink sm:px-1 sm:text-base">
            <Calendar className="h-4 w-4 text-wit-blue" strokeWidth={2.3} />
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            aria-label={t("Mes siguiente", "Next month")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-wit-gray transition-colors hover:bg-wit-mist/60 hover:text-wit-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        {streakWeeks > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#fff7e8] px-3 py-2 text-xs font-bold text-orange-700">
            <Flame className="h-3.5 w-3.5" strokeWidth={2.1} />
            {t(
              `${streakWeeks} ${streakWeeks === 1 ? "semana seguida" : "semanas seguidas"}`,
              `${streakWeeks} ${streakWeeks === 1 ? "week in a row" : "weeks in a row"}`,
            )}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {entries.length > 0 ? (
            <p className="shrink-0 text-xs font-bold text-wit-gray">
              <span className="text-wit-ink">
                {monthlyScheduledCount} {t("de", "of")} {publishableEntries.length}{" "}
                {t("piezas", "pieces")}
              </span>
              <span className="text-wit-gray"> · </span>
              <span className="text-wit-blue">{monthlyProgressPct}%</span>
            </p>
          ) : null}
        </div>
        {entries.length > 0 ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wit-mist/60">
            <div
              className="wit-brand-gradient h-full rounded-full"
              style={{ width: `${monthlyProgressPct}%` }}
            />
          </div>
        ) : null}
      </div>

      {confirmingReplan ? (
        <div className="wit-glass mt-4 flex flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-wit-ink">
              {t(`Replanear ${monthLabel}`, `Replan ${monthLabel}`)}
            </p>
            <p className="mt-1 text-sm text-wit-gray">
              {pendingCount > 0
                ? t(
                    `Wit creará una nueva propuesta para las ${pendingCount} piezas pendientes. Las que ya están en diseño o listas se conservan.`,
                    `Wit will create a new proposal for the ${pendingCount} pending pieces. Pieces already in design or ready are kept.`,
                  )
                : t(
                    "Wit conservará las piezas que ya están en diseño o listas y te ayudará a completar lo que falte.",
                    "Wit will keep pieces already in design or ready and help you complete what is missing.",
                  )}
            </p>
          </div>
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

      {entriesQuery.isLoading ? (
        <div className="mt-3 h-64 animate-pulse rounded-3xl bg-wit-mist/30" />
      ) : entries.length === 0 ? (
        <div className="wit-glass mt-3 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-wit-ink/15 px-6 py-16 text-center">
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
        <div className="mt-3 grid grid-cols-1 gap-5 pb-0 lg:grid-cols-[1fr_320px]">
          {/* Same grid at every size — only the density changes (smaller
              cells/text on a phone) instead of swapping to a separate
              agenda-list layout on mobile. */}
          <div id="calendario-planificacion" className="wit-glass rounded-3xl p-2.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)] sm:p-4">
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
                    onClick={(event) => {
                      if (!entry) return;
                      detailTriggerRef.current = event.currentTarget;
                      setSelectedId(entry.id);
                    }}
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
                        <img
                          src={entry!.thumbHref!}
                          alt={entry!.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
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
                        <span
                          className={`relative z-10 mt-auto flex flex-col items-start gap-0.5 overflow-hidden rounded-md px-1 py-0.5 text-[8px] font-semibold sm:rounded-lg sm:px-1.5 sm:py-1 ${statusMeta(entry.status, t).badgeClass}`}
                        >
                          <span className="flex items-center gap-1">
                            <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2.4} />
                            <span className="hidden text-[8px] font-bold uppercase tracking-wide sm:inline">
                              {formatLabel(entry.format, t)}
                            </span>
                          </span>
                          <span className="hidden w-full truncate text-[9px] font-semibold leading-tight sm:inline">
                            {entry.title}
                          </span>
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

          {selected ? (
            <EntryDetail
              entry={selected}
              onClose={() => {
                setSelectedId(null);
                requestAnimationFrame(() => detailTriggerRef.current?.focus());
              }}
            />
          ) : null}
        </div>
      )}

      {entries.length > 0 ? (
        <section className="mt-6 rounded-3xl border border-[rgba(20,30,60,0.06)] bg-white p-5 text-wit-ink shadow-[0_8px_30px_rgba(20,30,60,0.06)] sm:p-[22px]">
          <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-x-4 min-[360px]:grid-cols-[minmax(0,1fr)_auto] min-[360px]:gap-x-5">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-wit-pink/10 text-wit-pink">
                  <CalendarClock className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-[20px] font-extrabold leading-[1.2] tracking-tight text-wit-ink sm:text-[22px]">
                    {monthlyScheduledCount === 0
                      ? t("Programa tu mes", "Schedule your month")
                      : monthlyPendingCount === 0 && monthlyExpiredCount === 0
                        ? t(`${monthLabel} está programado ✓`, `${monthLabel} is scheduled ✓`)
                        : t("Tu mes está en marcha", "Your month is underway")}
                  </h2>
                  <p className="mt-2 text-[15px] font-medium leading-snug text-wit-gray sm:text-base">
                    {monthlyPendingCount === 0 && monthlyExpiredCount === 0
                      ? t(
                          `${monthlyScheduledCount} piezas listas`,
                          `${monthlyScheduledCount} pieces ready`,
                        )
                      : monthlyScheduledCount
                        ? t(
                            `${monthlyScheduledCount} de ${publishableEntries.length} piezas programadas`,
                            `${monthlyScheduledCount} of ${publishableEntries.length} pieces scheduled`,
                          )
                        : t(
                            `Tienes ${monthlyPendingCount} piezas pendientes de programación.`,
                            `You have ${monthlyPendingCount} pieces pending scheduling.`,
                          )}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgba(80,90,130,0.10)]">
                <div
                  className="wit-brand-gradient h-full rounded-full"
                  style={{ width: `${monthlyProgressPct}%` }}
                />
              </div>
            </div>
            <div className="grid content-start gap-3 border-l border-[rgba(20,30,60,0.08)] pl-4 text-left">
              <span>
                <b className="block text-[26px] font-extrabold leading-none text-violet-700 sm:text-[30px]">
                  {monthlyScheduledCount}
                </b>
                <small className="mt-1 block text-[13px] font-semibold text-wit-gray sm:text-sm">
                  {t(
                    monthlyScheduledCount === 1 ? "Programada" : "Programadas",
                    monthlyScheduledCount === 1 ? "Scheduled" : "Scheduled",
                  )}
                </small>
              </span>
              {monthlyExpiredCount > 0 ? (
                <span>
                  <b className="block text-[26px] font-extrabold leading-none text-amber-700 sm:text-[30px]">
                    {monthlyExpiredCount}
                  </b>
                  <small className="mt-1 block text-[13px] font-semibold text-amber-700 sm:text-sm">
                    {t("Fecha vencida", "Expired")}
                  </small>
                </span>
              ) : null}
              <span>
                <b className="block text-[26px] font-extrabold leading-none text-wit-pink sm:text-[30px]">
                  {monthlyPendingCount}
                </b>
                <small className="mt-1 block text-[13px] font-semibold text-wit-gray sm:text-sm">
                  {t("Pendientes", "Pending")}
                </small>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMonthlyProgrammingOpen(true)}
            className="wit-brand-gradient mt-5 flex min-h-[58px] w-full items-center justify-center rounded-[18px] p-px text-sm font-extrabold text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-blue focus-visible:ring-offset-2"
          >
            <span className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[17px] bg-white px-4">
              <CalendarClock className="h-4 w-4" />
              {monthlyPendingCount === 0 && monthlyExpiredCount === 0
                ? t("Ver programación", "View schedule")
                : monthlyScheduledCount
                  ? t("Continuar programación", "Continue scheduling")
                  : t("Programar contenido del mes", "Schedule month's content")}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </section>
      ) : null}

      {wizardOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-white">
              <CalendarWizard
                targetYear={year}
                targetMonth={month}
                monthLabel={monthLabel}
                initialBrandMindOpen={openBrandMindFromHeader}
                onClose={() => {
                  setWizardOpen(false);
                  setOpenBrandMindFromHeader(false);
                }}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["calendar-entries"] });
                  setWizardOpen(false);
                  setOpenBrandMindFromHeader(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
      {monthlyProgrammingOpen ? (
        <MonthlyProgrammingSheet
          entries={entries}
          year={year}
          month={month}
          monthLabel={monthLabel}
          scheduledCount={monthlyScheduledCount}
          onClose={() => setMonthlyProgrammingOpen(false)}
        />
      ) : null}
    </div>
  );
}
