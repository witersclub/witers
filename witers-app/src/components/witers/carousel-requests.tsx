// Client-facing "carruseles" — the carousel counterpart of panel.tsx's
// image-request flow and video-requests.tsx's video flow (Grow/Scale
// already sell "2/4 carruseles" in membership-plans.ts, this is what
// fulfills it). Lives inside Creatividad as a third sibling request type,
// same "hacer solicitud / mis solicitudes" shape as images and video —
// panel.tsx owns the query, the tab state, and the wizard portal, exactly
// like it does for the other two; this file just exports the pieces it
// composes. Unlike images/video, a carousel request is always built through
// Wit (never a manual form) and always produces exactly 4 ordered slides.
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, GalleryHorizontal, Loader2, Pencil } from "lucide-react";

import { WMark } from "./brand";
import { ChatBubble } from "./chat-intake";
import { AspectRatioPicker } from "./lab-pickers";
import { MicButton } from "./mic-button";

export type CarouselSlideInfo = {
  id: string;
  slide_index: number;
  title: string;
  brief: string;
  delivered_key: string | null;
  delivered_at: string | null;
  change_request_note: string | null;
  change_requested_at: string | null;
};

export type CarouselRequestRow = {
  id: string;
  status: string;
  title: string;
  aspect_ratio: string;
  created_at: string;
  slides_json: string | null;
};

function parseSlides(row: CarouselRequestRow): CarouselSlideInfo[] {
  if (!row.slides_json) return [];
  try {
    return (JSON.parse(row.slides_json) as CarouselSlideInfo[])
      .filter((s) => s.id)
      .sort((a, b) => a.slide_index - b.slide_index);
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  nueva: { label: "En cola", cls: "bg-amber-50 text-amber-700" },
  en_proceso: { label: "En diseño", cls: "bg-amber-50 text-amber-700" },
  completada: { label: "Listo", cls: "bg-emerald-50 text-emerald-700" },
  rechazada: { label: "Rechazada", cls: "bg-red-50 text-red-600" },
};

// Same landing pattern as VideoLandingScreen (and panel.tsx's
// HablaConWitScreen for images) — a big centered call to action, not a form.
export function CarouselLandingScreen({
  active,
  quotaUsed,
  quotaTotal,
  onStart,
}: {
  active: boolean;
  quotaUsed: number;
  quotaTotal: number;
  onStart: () => void;
}) {
  const remaining = quotaTotal - quotaUsed;
  const blocked = !active || remaining <= 0;

  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-3xl bg-wit-ice py-20 text-center">
      <div className="wit-float">
        <GalleryHorizontal className="h-11 w-11 text-wit-blue" strokeWidth={1.5} />
      </div>
      <p className="max-w-xs text-base text-wit-gray">
        {quotaTotal === 0
          ? "Los planes Grow y Scale incluyen carruseles para redes sociales."
          : remaining <= 0
            ? "Ya usaste tus carruseles disponibles este mes. Vuelven a estar disponibles en tu próximo ciclo."
            : "Cuéntale a Wit de qué quieres tu carrusel — él arma las 4 láminas contigo."}
      </p>
      {quotaTotal === 0 ? (
        <a
          href="/upgrade"
          className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
        >
          Ver planes
        </a>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={blocked}
          className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          🖼️ Nuevo carrusel
        </button>
      )}
      {quotaTotal > 0 ? (
        <p className="text-xs font-semibold text-wit-gray">
          {quotaUsed} de {quotaTotal} carruseles usados este mes.
        </p>
      ) : null}
    </div>
  );
}

export function CarouselRequestList({
  rows,
  loading,
}: {
  rows: CarouselRequestRow[];
  loading: boolean;
}) {
  return (
    <section>
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="wit-glass rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
          <p className="text-base font-semibold text-wit-ink">Aún no tienes carruseles.</p>
          <p className="mt-1 text-sm text-wit-gray">
            Cuéntale a Wit de qué quieres tu carrusel de 4 láminas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <CarouselEntry key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function CarouselEntry({ row }: { row: CarouselRequestRow }) {
  const qc = useQueryClient();
  const st = STATUS_LABEL[row.status] ?? STATUS_LABEL.nueva;
  const slides = parseSlides(row);
  // null = closed, 0 = "todo el carrusel", 1-4 = esa lámina puntual.
  const [changeTarget, setChangeTarget] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  async function sendChange() {
    if (message.trim().length < 5) {
      setMsg("Cuéntanos con un poco más de detalle qué quieres ajustar.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/carousel-request-change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          carouselRequestId: row.id,
          slideIndex: changeTarget ? changeTarget : null,
          message,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setMessage("");
        setChangeTarget(null);
        setSentMsg("Recibimos tu pedido de cambio. El equipo lo va a retomar.");
        await qc.invalidateQueries({ queryKey: ["carousel-requests"] });
      } else {
        setMsg("No pudimos enviar tu pedido. Intenta de nuevo.");
      }
    } catch {
      setMsg("No pudimos enviar tu pedido. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wit-glass rounded-2xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GalleryHorizontal className="h-4 w-4 shrink-0 text-wit-gray" strokeWidth={2} />
            <p className="truncate text-sm font-bold text-wit-ink">{row.title}</p>
          </div>
          <p className="mt-1 text-xs text-wit-gray">
            {row.aspect_ratio} · 4 láminas ·{" "}
            {new Date(row.created_at + "Z").toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}
        >
          {row.status === "en_proceso" || row.status === "nueva" ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
          ) : null}
          {st.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slides.map((s) => (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="relative overflow-hidden rounded-xl border border-wit-ink/10 bg-wit-ice">
              {s.delivered_key ? (
                <img
                  src={`/api/file?key=${encodeURIComponent(s.delivered_key)}`}
                  alt={s.title || `Lámina ${s.slide_index}`}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center px-2 text-center text-[11px] font-semibold text-wit-gray">
                  Pendiente
                </div>
              )}
              {s.delivered_key ? (
                <button
                  type="button"
                  onClick={() => {
                    setSentMsg(null);
                    setChangeTarget(s.slide_index);
                  }}
                  aria-label={`Pedir cambio en lámina ${s.slide_index}`}
                  title="Pedir cambio en esta lámina"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-wit-gray shadow hover:text-wit-blue"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.3} />
                </button>
              ) : null}
              {s.change_request_note ? (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-white">
                  Cambio pedido
                </span>
              ) : null}
            </div>
            <p className="line-clamp-1 text-center text-[11px] font-semibold text-wit-gray">
              Lámina {s.slide_index}
            </p>
          </div>
        ))}
      </div>

      {row.status === "completada" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href={`/api/file?key=${encodeURIComponent(slides[0]?.delivered_key ?? "")}&download=1`}
            className="inline-flex items-center gap-1.5 rounded-full border border-wit-ink/15 px-4 py-2 text-xs font-bold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.3} />
            Descargar lámina 1
          </a>
          <button
            type="button"
            onClick={() => {
              setSentMsg(null);
              setChangeTarget(0);
            }}
            className="rounded-full border border-wit-ink/15 px-4 py-2 text-xs font-bold text-wit-ink hover:border-wit-blue hover:text-wit-blue"
          >
            Pedir cambio en todo el carrusel
          </button>
        </div>
      ) : null}

      {changeTarget !== null ? (
        <div className="mt-4 rounded-xl bg-wit-mist/40 p-4">
          <p className="text-xs font-bold text-wit-ink">
            {changeTarget === 0 ? "Cambio en las 4 láminas" : `Cambio en la lámina ${changeTarget}`}
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Cuéntanos qué quieres ajustar..."
            className="mt-2 w-full rounded-xl border border-wit-ink/15 px-3.5 py-2.5 text-sm outline-none focus:border-wit-blue"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={sendChange}
              className="rounded-full bg-wit-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
            >
              {busy ? "Enviando..." : "Enviar pedido"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setChangeTarget(null)}
              className="text-sm font-semibold text-wit-gray hover:text-wit-ink"
            >
              Cancelar
            </button>
          </div>
          {msg ? <p className="mt-2 text-sm text-red-600">{msg}</p> : null}
        </div>
      ) : null}

      {sentMsg ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {sentMsg}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- wizard (Wit chat) ---------- */

type WitMessage = { role: "user" | "assistant"; content: string; widget?: "aspectRatio" };
type CarouselSlideDraft = { title: string; brief: string };
type CarouselDetails = { title: string; aspectRatio: string; slides: CarouselSlideDraft[] };
const ASPECT_RATIO_PROMPT = "¿Qué forma te imaginas para las 4 láminas?";

export function CarouselWizard({
  disabledReason,
  onCreated,
  onClose,
}: {
  disabledReason: string | null;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<WitMessage[]>([
    { role: "assistant", content: "¡Hola! Cuéntame, ¿de qué quieres tu carrusel de 4 láminas?" },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [awaitingAspectRatio, setAwaitingAspectRatio] = useState(false);
  const [details, setDetails] = useState<CarouselDetails | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, awaitingAspectRatio, details]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [input]);

  async function askWit(nextMessages: WitMessage[]) {
    setTyping(true);
    setChatError(null);
    try {
      const res = await fetch("/api/wit/carousel-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: "message"; text: string }
        | { ok: true; kind: "ask_aspect_ratio" }
        | { ok: true; kind: "done"; details: CarouselDetails }
        | { ok: false; error: string };
      if (!data.ok) {
        setChatError("Wit no está disponible en este momento. Intenta de nuevo en un momento.");
        return;
      }
      if (data.kind === "message") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else if (data.kind === "ask_aspect_ratio") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: ASPECT_RATIO_PROMPT, widget: "aspectRatio" },
        ]);
        setAwaitingAspectRatio(true);
      } else {
        setDetails(data.details);
      }
    } catch {
      setChatError("No pudimos hablar con Wit. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setTyping(false);
    }
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing || details) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    void askWit(next);
  }

  function pickAspectRatio(value: string) {
    setAwaitingAspectRatio(false);
    const next: WitMessage[] = [
      ...messages,
      { role: "user", content: `Elijo el formato: ${value}.` },
    ];
    setMessages(next);
    void askWit(next);
  }

  async function confirmSend() {
    if (!details) return;
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch("/api/carousel-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: details.title,
          aspectRatio: details.aspectRatio,
          slides: details.slides,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setSendError(
          data.error === "sin_saldo"
            ? "Ya usaste todos tus carruseles disponibles este mes."
            : data.error === "sin_membresia"
              ? "Necesitas una membresía activa para enviar solicitudes."
              : "No pudimos enviar tu carrusel. Intenta de nuevo.",
        );
        return;
      }
      onCreated();
    } catch {
      setSendError("No pudimos enviar tu carrusel. Intenta de nuevo.");
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
          aria-label="Cerrar chat"
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
        >
          ×
        </button>
        <div className="wit-float">
          <WMark size={26} />
        </div>
        <p className="text-sm font-medium text-wit-ink">Armando tu carrusel con Wit</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 py-4">
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-3">
              <ChatBubble role={m.role} text={m.content} />
              {m.widget === "aspectRatio" && awaitingAspectRatio ? (
                <AspectRatioPicker onPick={pickAspectRatio} />
              ) : null}
            </div>
          ))}
          {typing ? <ChatBubble role="assistant" typingDots /> : null}
          {chatError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {chatError}
            </p>
          ) : null}
          {details ? (
            <>
              <ChatBubble
                role="assistant"
                text="¡Listo! Revisa las 4 láminas antes de enviarlas:"
              />
              <div className="wit-glass rounded-2xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
                <p className="text-sm font-bold text-wit-ink">{details.title}</p>
                <p className="mt-0.5 text-xs text-wit-gray">Formato: {details.aspectRatio}</p>
                <div className="mt-4 space-y-3">
                  {details.slides.map((s, i) => (
                    <div key={i} className="rounded-xl bg-wit-ice/60 px-4 py-3">
                      <p className="text-xs font-bold text-wit-blue">
                        Lámina {i + 1}
                        {s.title ? ` — ${s.title}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-wit-ink">{s.brief}</p>
                    </div>
                  ))}
                </div>
                {disabledReason ? (
                  <p className="mt-4 text-sm font-semibold text-red-600">{disabledReason}</p>
                ) : (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={confirmSend}
                    className="mt-4 w-full rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-50"
                  >
                    {sending ? "Enviando..." : "Enviar carrusel"}
                  </button>
                )}
                {sendError ? <p className="mt-2 text-sm text-red-600">{sendError}</p> : null}
              </div>
            </>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {!details && !awaitingAspectRatio ? (
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
              aria-label="Tu mensaje"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText(input);
                }
              }}
              disabled={typing}
              placeholder="Escribe tu mensaje..."
              className="max-h-[160px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-2.5 text-base text-wit-ink outline-none placeholder:text-wit-gray disabled:opacity-50"
            />
            <MicButton value={input} onChange={setInput} />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Enviar mensaje"
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
