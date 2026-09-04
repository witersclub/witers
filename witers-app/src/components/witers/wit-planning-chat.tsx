import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Sparkles, X } from "lucide-react";

import { ChatBubble } from "./chat-intake";
import { WMark } from "./brand";
import { useLanguage } from "../../lib/i18n";

// CAMBIO 02 — "Planificar con Wit": free-text alternative to
// guided-planning-sheet.tsx's step-by-step wizard, not a replacement for
// it. Reuses ChatBubble from chat-intake.tsx (same message-bubble look as
// the rest of WITERS' chats) but keeps its own lightweight composer —
// chat-intake.tsx's ChatIntakeFlow is built around a fixed one-question-
// at-a-time list, which doesn't fit "type one paragraph, Wit infers
// everything at once". The backend (runWitPlanningBrief) only ever
// extracts into the wizard's own fields; it never generates a plan by
// itself — see planning-chat.ts.
type ChatMessage = { role: "user" | "assistant"; content: string };

// Mirrors PlanningBrief in wit-chat.server.ts — kept as a plain client-side
// type rather than importing the .server.ts module (server code isn't
// bundled to the client), same pattern already used for CalendarEntryDraft
// in this same file's sibling, guided-planning-sheet.tsx.
export type PlanningBrief = {
  objectives: Array<"messages" | "sales" | "community" | "brand" | "other">;
  otherObjective: string;
  frequencyPerWeek: number;
  weekdays: number[];
  formats: Array<"imagen" | "video" | "carrusel">;
  specialInfo: string;
};

export function WitPlanningChat({
  monthLabel,
  mode = "create",
  existingEntries = [],
  onClose,
  onBriefReady,
}: {
  monthLabel: string;
  mode?: "create" | "adjust";
  existingEntries?: { date: string; format: "imagen" | "video" | "carrusel"; title: string }[];
  onClose: () => void;
  onBriefReady: (brief: PlanningBrief) => void;
}) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        mode === "adjust"
          ? t(
              `Tu plan de ${monthLabel} ya tiene ${existingEntries.length} piezas. Cuéntame qué quieres ajustar y actualizo tu planificación.`,
              `Your plan for ${monthLabel} already has ${existingEntries.length} pieces. Tell me what you want to change and I'll update it.`,
            )
          : t(
              `Cuéntame cómo quieres manejar tu contenido de ${monthLabel}.\nPuedes explicármelo con tus propias palabras y yo organizaré la planificación por ti.`,
              `Tell me how you want to handle your ${monthLabel} content.\nYou can explain it in your own words and I'll organize the plan for you.`,
            ),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<PlanningBrief | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, brief]);

  async function send() {
    const text = input.trim();
    if (!text || typing) return;
    setError(null);
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setTyping(true);
    try {
      const res = await fetch("/api/wit/planning-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, monthLabel, mode, existingEntries }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: "message"; text: string }
        | { ok: true; kind: "done"; brief: PlanningBrief }
        | { ok: false; error: string };
      if (!data.ok) {
        setError(
          t(
            "Wit no está disponible en este momento. Intenta de nuevo.",
            "Wit isn't available right now. Try again.",
          ),
        );
        return;
      }
      if (data.kind === "done") {
        setBrief(data.brief);
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.text }]);
    } catch {
      setError(
        t(
          "No pudimos enviar tu mensaje. Revisa tu conexión e intenta de nuevo.",
          "We couldn't send your message. Check your connection and try again.",
        ),
      );
    } finally {
      setTyping(false);
    }
  }

  const objectiveLabels: Record<PlanningBrief["objectives"][number], string> = {
    messages: t("Más mensajes", "More messages"),
    sales: t("Más ventas", "More sales"),
    community: t("Crecer comunidad", "Grow community"),
    brand: t("Posicionar marca", "Position the brand"),
    other: t("Otro objetivo", "Other objective"),
  };
  const formatLabels: Record<"imagen" | "video" | "carrusel", string> = {
    imagen: t("Imágenes", "Images"),
    video: t("Reels", "Reels"),
    carrusel: t("Carruseles", "Carousels"),
  };

  const content = (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-wit-ink/25 p-0 backdrop-blur-[2px] md:items-center md:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wit-planning-chat-title"
        className="relative flex h-[88dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_-12px_48px_rgba(10,30,80,0.16)] motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-[400ms] md:h-[80dvh] md:max-h-[720px] md:rounded-[30px]"
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-wit-ink/15 md:hidden" />
        <header className="flex items-center gap-3 px-6 pb-3 pt-5 md:px-8">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="wit-planning-chat-title" className="text-base font-extrabold text-wit-ink">
              {t("Planeando con Wit", "Planning with Wit")} ✨
            </h2>
            <p className="text-xs font-semibold text-wit-gray">{monthLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Cerrar", "Close")}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full text-wit-gray transition hover:bg-wit-mist/70 hover:text-wit-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-7">
          {brief ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-wit-blue/[0.08] text-wit-blue">
                <Sparkles className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-xl font-extrabold text-wit-ink">
                {t("Esto entendí", "Here's what I understood")}
              </h3>
              {/* CAMBIO 15 — B3: one compact, scannable card instead of a
                  table-like dl. The formats line is now always sourced
                  straight from brief.formats (never re-derived or
                  re-worded here), so this card and the generated calendar
                  can never disagree about what was actually requested. */}
              <div className="mt-6 w-full rounded-2xl border border-wit-ink/7 bg-wit-mist/20 p-4 text-left">
                <p className="text-sm leading-relaxed text-wit-ink">
                  <b>
                    {brief.objectives
                      .map((o) =>
                        o === "other"
                          ? brief.otherObjective || objectiveLabels.other
                          : objectiveLabels[o],
                      )
                      .join(" · ")}
                  </b>
                  {" — "}
                  {t(
                    `${brief.frequencyPerWeek} veces por semana`,
                    `${brief.frequencyPerWeek} times per week`,
                  )}
                  {" · "}
                  {brief.formats.length
                    ? brief.formats.map((f) => formatLabels[f]).join(" · ")
                    : t("Mezcla recomendada", "Recommended mix")}
                </p>
                {brief.specialInfo ? (
                  <p className="mt-2 text-xs leading-relaxed text-wit-gray">{brief.specialInfo}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onBriefReady(brief)}
                className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-wit-blue px-5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(0,71,255,0.2)]"
              >
                {t("Ver mi planificación →", "View my plan →")}
              </button>
              <button
                type="button"
                onClick={() => setBrief(null)}
                className="mt-3 min-h-11 text-sm font-bold text-wit-blue"
              >
                {t("Seguir platicando con Wit", "Keep chatting with Wit")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              {messages.map((message, index) => (
                <ChatBubble key={index} role={message.role} text={message.content} />
              ))}
              {typing ? <ChatBubble role="assistant" typingDots /> : null}
              {error ? (
                <p className="self-start text-xs font-semibold text-red-600">{error}</p>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {!brief ? (
          <footer className="flex shrink-0 items-end gap-2 border-t border-wit-ink/7 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:px-7">
            <span className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
              <WMark size={16} />
            </span>
            <textarea
              ref={composerRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={t(
                "Escribe cómo quieres tu mes…",
                "Write how you want your month to go…",
              )}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-wit-ink/12 bg-wit-mist/20 px-4 py-2.5 text-sm outline-none focus:border-wit-blue"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || typing}
              aria-label={t("Enviar", "Send")}
              className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wit-blue text-white shadow-[0_8px_18px_rgba(0,71,255,0.2)] transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(content, document.body);
}
