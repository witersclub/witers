import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { WitersLogo, WMark } from "../components/witers/brand";

// The Web Speech API has no official TS lib entry — declare just the
// pieces we use rather than pulling in a whole @types package for one file.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export const Route = createFileRoute("/admin-lab")({
  head: () => ({
    meta: [
      { title: "Laboratorio IA. WITERS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AiLab,
});

type Fields = {
  title: string;
  companyName: string;
  productName: string;
  brief: string;
  pieceBrief: string;
  style: string;
  pieceType: string;
  businessType: string;
  aspectRatio: string;
  audience: string;
  ageRanges: string[];
  promoPrice: string;
  requiredText: string;
  colors: string[];
  missingInfo: string[];
};

// One question per field the real form needs — the conversation IS the
// form, asked one thing at a time instead of dumped as a wall of inputs.
// The raw answers get stitched into a transcript and handed to the same
// /api/admin/ai-fill endpoint the freeform lab used, which normalizes
// what's left as genuinely free text (brief, pieceBrief, etc).
// pieceType/aspectRatio/colors/style are answered through dedicated
// pickers instead of free text, so those are never sent through the AI at
// all — see generate() below, which merges them straight from `answers`
// into the final Fields.
const QUESTIONS: { field: string; label: string; short: string; text: string; required: boolean }[] = [
  {
    field: "pieceType",
    label: "Tipo de pieza",
    short: "Tipo",
    text: "¿Qué tipo de pieza quieres crear hoy?",
    required: false,
  },
  {
    field: "aspectRatio",
    label: "Formato",
    short: "Formato",
    text: "¿Qué forma tiene la pieza que te imaginas?",
    required: false,
  },
  {
    field: "companyName",
    label: "Empresa",
    short: "Empresa",
    text: "¿Cuál es el nombre de tu empresa o marca?",
    required: true,
  },
  {
    field: "colors",
    label: "Colores de marca",
    short: "Colores",
    text: "¿Tienes colores de marca que debamos usar? Si no tienes, elige los que más te gusten.",
    required: true,
  },
  {
    field: "style",
    label: "Estilo",
    short: "Estilo",
    text: "¿Qué estilo visual te gustaría para tu pieza?",
    required: true,
  },
  {
    field: "businessType",
    label: "Categoría de negocio",
    short: "Categoría",
    text: "¿En qué categoría cae tu negocio?",
    required: true,
  },
  {
    field: "brief",
    label: "A qué se dedica",
    short: "Rubro",
    text: "Cuéntame, ¿a qué se dedica tu negocio?",
    required: true,
  },
  {
    field: "pieceBrief",
    label: "Qué debe mostrar la pieza",
    short: "La pieza",
    text: "¿Qué quieres que muestre esta pieza en concreto?",
    required: true,
  },
  {
    field: "title",
    label: "Título de la pieza",
    short: "Título",
    text: "Si le pusieras un título corto a esta pieza, ¿cuál sería?",
    required: true,
  },
  {
    field: "audience",
    label: "Público objetivo",
    short: "Público",
    text: "¿A quién quieres llegarle con esta pieza?",
    required: false,
  },
  {
    field: "promoPrice",
    label: "Precio o descuento",
    short: "Precio",
    text: "¿Hay algún precio o descuento que quieras destacar? Si no aplica, dime que no.",
    required: false,
  },
  {
    field: "requiredText",
    label: "Texto obligatorio",
    short: "Texto",
    text: "¿Hay algún texto o dato que deba aparecer sí o sí en la pieza?",
    required: false,
  },
];

const ASPECT_OPTIONS: { value: string; label: string }[] = [
  { value: "1:1", label: "Cuadrado" },
  { value: "4:3", label: "Feed" },
  { value: "16:9", label: "Horizontal" },
  { value: "3:4", label: "Vertical" },
  { value: "9:16", label: "Historia" },
];

const PIECE_TYPE_OPTIONS = ["Instagram", "Historia", "Facebook", "Banner web", "Impreso", "Otro"];

// No real photography to preview each style with, so each swatch is a small
// CSS treatment that evokes the vibe instead: minimalista plain, elegante
// dark, colorido a vivid gradient, corporativo structured blues, bold loud.
const STYLE_OPTIONS: { value: string; swatchClass: string }[] = [
  { value: "Minimalista", swatchClass: "border border-wit-ink/15 bg-white" },
  { value: "Premium / Elegante", swatchClass: "bg-gradient-to-br from-wit-ink to-black" },
  { value: "Colorido", swatchClass: "bg-gradient-to-br from-pink-400 via-amber-300 to-sky-400" },
  { value: "Corporativo", swatchClass: "bg-gradient-to-br from-wit-blue to-wit-navy" },
  { value: "Divertido / Bold", swatchClass: "bg-gradient-to-br from-orange-400 to-fuchsia-500" },
];

// Curated, not exhaustive — covers the industries a design membership
// service actually sees, with "Otro" (typed free text) as the escape
// valve for the long tail instead of trying to enumerate every business.
const BUSINESS_INDUSTRIES: { value: string; types: string[] }[] = [
  { value: "Alimentos y bebidas", types: ["Restaurante", "Cafetería", "Panadería / Repostería", "Bar", "Catering"] },
  { value: "Salud y bienestar", types: ["Spa / Centro de bienestar", "Consultorio médico", "Clínica dental", "Psicología / Terapia"] },
  { value: "Belleza", types: ["Salón de belleza", "Barbería", "Nail spa"] },
  { value: "Fitness", types: ["Gimnasio", "Yoga / Pilates", "Entrenador personal"] },
  { value: "Moda y retail", types: ["Tienda de ropa", "Joyería", "Tienda en línea"] },
  { value: "Educación", types: ["Academia / Curso", "Guardería"] },
  { value: "Servicios profesionales", types: ["Consultoría / Contabilidad", "Bufete legal", "Agencia de marketing"] },
  { value: "Bienes raíces y construcción", types: ["Inmobiliaria", "Construcción / Remodelación"] },
  { value: "Automotriz", types: ["Taller mecánico"] },
  { value: "Eventos", types: ["Organización de eventos", "Fotografía / Video"] },
  { value: "Tecnología", types: ["Software / Apps"] },
  { value: "Mascotas", types: ["Veterinaria / Pet shop"] },
];

const WHEEL_ITEM_HEIGHT = 32;
const WHEEL_VISIBLE_ROWS = 3;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;

// One shared AudioContext, created lazily on the first tick (needs a user
// gesture to actually produce sound in most browsers, and scrolling the
// wheel counts as one). Best-effort only — a missing Vibration API (iOS
// Safari has none) or blocked audio should never break the picker itself.
let wheelAudioCtx: AudioContext | null = null;
function playWheelTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!wheelAudioCtx) wheelAudioCtx = new Ctx();
    if (wheelAudioCtx.state === "suspended") void wheelAudioCtx.resume();
    const osc = wheelAudioCtx.createOscillator();
    const gain = wheelAudioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.06, wheelAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, wheelAudioCtx.currentTime + 0.04);
    osc.connect(gain).connect(wheelAudioCtx.destination);
    osc.start();
    osc.stop(wheelAudioCtx.currentTime + 0.05);
  } catch {
    // sound is a nice-to-have — never let it throw into the scroll handler
  }
}

function buildTranscript(answers: Record<string, string>): string {
  return QUESTIONS.map((q) => {
    const v = (answers[q.field] ?? "").trim();
    return `${q.label}: ${v || "(no especificado)"}`;
  }).join("\n");
}

function usePlatformUser() {
  return useQuery({
    queryKey: ["platform-user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; user?: { role?: string } };
      if (!body.ok || body.user?.role !== "admin") return null;
      return body.user as Record<string, unknown>;
    },
    staleTime: 30_000,
  });
}

function AiLab() {
  const platform = usePlatformUser();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [typing, setTyping] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuField, setMenuField] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<number | null>(null);
  const pressMovedRef = useRef(false);
  const activeEditRef = useRef<HTMLDivElement>(null);

  const done = stepIndex >= QUESTIONS.length;
  // The full chat view only takes over the screen once the first answer is
  // sent — before that it's a small, centered composer, closer to how
  // ChatGPT/Claude start before the first message.
  const started = stepIndex > 0;

  // Chat transcript built from questions already answered, in order —
  // derived straight from `answers`/`stepIndex` instead of a separate
  // messages array, so there's nothing extra to keep in sync.
  const answeredEntries = QUESTIONS.slice(0, stepIndex).map((q) => ({
    field: q.field,
    question: q.text,
    answer: (answers[q.field] ?? "").trim() || "Omitido",
  }));

  // Keep the conversation scrolled to the latest message as it grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [stepIndex, typing, done, loading, fields]);

  // Tapping/clicking anywhere outside the active popup or edit box closes
  // it — checked against the actual rendered element (via ref), not a
  // specific field, so this covers both menuField and editingField the
  // same way regardless of which one is currently open.
  useEffect(() => {
    if (!menuField && !editingField) return;
    const dismiss = (ev: Event) => {
      if (!activeEditRef.current?.contains(ev.target as Node | null)) {
        setMenuField(null);
        cancelEditing();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuField, editingField]);

  // Press-and-hold a sent answer to reveal a tiny "Editar" popup, instead of
  // a link sitting under every bubble all the time.
  function handlePressStart(field: string) {
    pressMovedRef.current = false;
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      if (!pressMovedRef.current) setMenuField(field);
    }, 450);
  }
  function handlePressMove() {
    pressMovedRef.current = true;
  }
  function handlePressEnd() {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  // Don't leave the mic listening in the background if the admin leaves —
  // covers both an in-app navigation (React unmount) and a hard exit
  // (closing the tab, typing a new URL), which unmount alone won't catch.
  // abort() cuts the mic immediately instead of stop()'s graceful, slightly
  // delayed wind-down.
  useEffect(() => {
    const killMic = () => {
      manualStopRef.current = true;
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
    window.addEventListener("pagehide", killMic);
    return () => {
      window.removeEventListener("pagehide", killMic);
      killMic();
    };
  }, []);

  // The mic session spans the whole conversation now (no stop-between-
  // questions), so its callbacks are wired up once and must always see the
  // latest state — refs kept in sync every render, read from inside those
  // callbacks instead of stale closures.
  const submitAnswerRef = useRef((_text: string) => {});
  const stepIndexRef = useRef(stepIndex);
  const doneRef = useRef(done);
  stepIndexRef.current = stepIndex;
  doneRef.current = done;

  // `capturedAnswers` is passed in explicitly (not read from the `answers`
  // state closure) because this runs inside a setTimeout scheduled by
  // submitAnswer/saveEdit — by the time it fires, the closure that created
  // it is stale relative to the latest setAnswers() call.
  async function generate(text: string, capturedAnswers: Record<string, string>) {
    setLoading(true);
    setError(null);
    setFields(null);
    try {
      const res = await fetch("/api/admin/ai-fill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = (await res.json()) as { ok: boolean; fields?: Fields; error?: string };
      if (!data.ok || !data.fields) {
        setError(
          data.error === "falta_openai_api_key"
            ? "Falta configurar OPENAI_API_KEY en el Worker."
            : "No pudimos generar los campos. Intenta de nuevo.",
        );
        return;
      }
      // pieceType/aspectRatio/colors/style came from dedicated pickers, not
      // free text — use the exact values the client chose instead of
      // whatever the AI guessed from the transcript (it isn't even asked
      // for these).
      setFields({
        ...data.fields,
        pieceType: capturedAnswers.pieceType ?? "",
        aspectRatio: capturedAnswers.aspectRatio ?? "",
        style: capturedAnswers.style ?? "",
        businessType: capturedAnswers.businessType ?? "",
        colors: (capturedAnswers.colors ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });
    } catch {
      setError("No pudimos generar los campos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer(rawText: string) {
    const q = QUESTIONS[stepIndex];
    if (!q || done) return;
    const text = rawText.trim();
    if (!text && q.required) {
      setError("Este dato es necesario para continuar.");
      return;
    }
    setError(null);
    const nextAnswers = { ...answers, [q.field]: text };
    setAnswers(nextAnswers);
    setCurrentAnswer("");
    answerRef.current = "";
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (nextIndex >= QUESTIONS.length) {
        void generate(buildTranscript(nextAnswers), nextAnswers);
      }
    }, 550);
  }
  submitAnswerRef.current = submitAnswer;

  function startEditing(field: string, currentValue: string) {
    if (listening) stopListening();
    setError(null);
    setMenuField(null);
    setEditingField(field);
    setEditValue(currentValue);
  }

  function cancelEditing() {
    setEditingField(null);
    setEditValue("");
  }

  // Correcting an already-sent answer, in place — no need to redo the rest
  // of the conversation. If the AI already generated fields from the old
  // (wrong) transcript, that result is now stale, so it's cleared and
  // regenerated from the corrected answers.
  function saveEdit() {
    const field = editingField;
    if (!field) return;
    const q = QUESTIONS.find((x) => x.field === field);
    const text = editValue.trim();
    if (q?.required && !text) {
      setError("Este dato es necesario para continuar.");
      return;
    }
    setError(null);
    const nextAnswers = { ...answers, [field]: text };
    setAnswers(nextAnswers);
    setEditingField(null);
    setEditValue("");
    if (done && fields) {
      setFields(null);
      void generate(buildTranscript(nextAnswers), nextAnswers);
    }
  }

  function restart() {
    stopListening();
    setAnswers({});
    setStepIndex(0);
    setCurrentAnswer("");
    setFields(null);
    setError(null);
    setTyping(false);
    setEditingField(null);
    setEditValue("");
    setMenuField(null);
  }

  // Stops the hands-free session outright — used when the admin presses
  // the mic to cut it off, types an answer instead, or skips a question.
  // Does NOT fire on the silence-triggered auto-advance between questions,
  // which is the whole point: the mic stays open across the conversation.
  function stopListening() {
    manualStopRef.current = true;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      recognitionRef.current = null;
      rec.abort();
    }
    setListening(false);
  }

  // ~0.8s of silence after the last thing heard = "done answering this
  // one," so we submit whatever was said and move to the next question
  // without the admin ever touching the mic again.
  function scheduleSilenceCheck() {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      const text = answerRef.current.trim();
      if (!text) return;
      const wasLast = stepIndexRef.current >= QUESTIONS.length - 1;
      answerRef.current = "";
      setCurrentAnswer("");
      submitAnswerRef.current(text);
      if (wasLast) stopListening();
    }, 800);
  }

  function startListening() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Tu navegador no soporta reconocimiento de voz — escribe tu respuesta.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      if (finalChunk) answerRef.current = (answerRef.current + " " + finalChunk).trim();
      setCurrentAnswer((answerRef.current + " " + interim).trim());
      scheduleSilenceCheck();
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      manualStopRef.current = true;
      setListening(false);
      setError("No pudimos usar el micrófono. Revisa los permisos del navegador.");
    };
    recognition.onend = () => {
      setListening(false);
      // Chrome can end a continuous session on its own after a long idle
      // stretch — if we didn't ask for that and there are still questions
      // left, just pick the mic back up instead of leaving it dead.
      if (!manualStopRef.current && !doneRef.current) {
        startListening();
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function toggleMic() {
    setError(null);
    if (listening) {
      const text = answerRef.current.trim();
      stopListening();
      if (text) {
        answerRef.current = "";
        setCurrentAnswer("");
        submitAnswer(text);
      }
      return;
    }
    manualStopRef.current = false;
    answerRef.current = currentAnswer;
    startListening();
  }

  if (platform.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!platform.data) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          Este laboratorio requiere una cuenta con rol de administrador.
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Iniciar sesión de administrador
        </Link>
      </div>
    );
  }

  const showSend = !listening && currentAnswer.trim().length > 0;

  const composer = (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (listening) stopListening();
          submitAnswer(currentAnswer);
        }}
        className="wit-glass flex items-center gap-2 rounded-full p-1.5 pl-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
      >
        <input
          type="text"
          aria-label="Tu respuesta"
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          disabled={done}
          placeholder={done ? "" : "Escribe o presiona el micrófono..."}
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-wit-ink outline-none placeholder:text-wit-gray disabled:opacity-50"
        />
        {done ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : showSend ? (
          <button
            type="submit"
            aria-label="Enviar respuesta"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white transition-all hover:bg-wit-blue-deep"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9 22 2Z" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "Detener micrófono" : "Activar micrófono"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              listening
                ? "animate-pulse bg-red-500 text-white shadow-[0_0_0_6px_rgba(239,68,68,0.15)]"
                : "bg-wit-blue text-white hover:bg-wit-blue-deep"
            }`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
            </svg>
          </button>
        )}
      </form>
      {listening ? (
        <p className="mt-1.5 text-center text-[11px] text-wit-gray">Te escucho — sigue hablando, yo voy avanzando</p>
      ) : null}
    </>
  );

  // Tipo de pieza, formato y colores se contestan con un selector visual en
  // vez del campo de texto/mic — más fácil para un cliente que no sabe qué
  // es un hex o un aspect ratio, y elimina la necesidad de que la IA
  // adivine esos datos.
  const currentQuestion = QUESTIONS[stepIndex];
  const activeInput =
    currentQuestion?.field === "pieceType" ? (
      <PieceTypePicker onPick={submitAnswer} />
    ) : currentQuestion?.field === "aspectRatio" ? (
      <AspectRatioPicker onPick={submitAnswer} />
    ) : currentQuestion?.field === "colors" ? (
      <ColorsPicker onPick={submitAnswer} />
    ) : currentQuestion?.field === "style" ? (
      <StylePicker onPick={submitAnswer} />
    ) : currentQuestion?.field === "businessType" ? (
      <BusinessTypeWheel onPick={submitAnswer} />
    ) : (
      composer
    );

  if (!started) {
    return (
      <div className="wit-page min-h-dvh">
        <header className="wit-glass border-b border-wit-ink/10">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <Link to="/">
                <WitersLogo compact />
              </Link>
              <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
                LAB · SOLO ADMIN
              </span>
            </div>
            <Link to="/admin" className="wit-navlink text-sm font-medium text-wit-ink">
              ← Volver al panel
            </Link>
          </div>
        </header>

        <main className="wit-rise mx-auto flex h-[calc(100dvh-4rem)] max-w-sm flex-col items-center justify-center px-5 text-center">
          <div className="wit-float">
            <WMark size={32} />
          </div>
          <p className="mt-3 text-base font-medium text-wit-ink">Creemos tu pieza juntos</p>
          <p className="mt-2 text-sm text-wit-gray">{QUESTIONS[0].text}</p>

          {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="mt-6 w-full">{activeInput}</div>
          {!QUESTIONS[0].required ? (
            <button
              type="button"
              onClick={() => submitAnswer("")}
              className="mt-3 text-xs font-semibold text-wit-gray hover:text-wit-ink"
            >
              Omitir
            </button>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="wit-page min-h-dvh">
      <header className="wit-glass border-b border-wit-ink/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/">
              <WitersLogo compact />
            </Link>
            <span className="rounded-full bg-wit-mist/60 px-3 py-1 text-xs font-bold text-wit-blue">
              LAB · SOLO ADMIN
            </span>
          </div>
          <Link to="/admin" className="wit-navlink text-sm font-medium text-wit-ink">
            ← Volver al panel
          </Link>
        </div>
      </header>

      <main className="wit-rise mx-auto flex h-[calc(100dvh-4rem)] max-w-sm flex-col px-5">
        <div className="flex flex-col items-center gap-1.5 pb-1 pt-5">
          <div className="wit-float">
            <WMark size={26} />
          </div>
          <p className="text-sm font-medium text-wit-ink">Creemos tu pieza juntos</p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 py-4">
            {answeredEntries.map((e) => (
              <div key={e.field} className="flex flex-col gap-3">
                <ChatBubble role="assistant" text={e.question} />
                {editingField === e.field ? (
                  <div ref={activeEditRef} className="relative z-40 flex flex-col items-end gap-1.5 self-end">
                    <div className="flex w-full max-w-[230px] items-center rounded-2xl rounded-br-sm border-2 border-wit-blue bg-white px-3.5 py-2">
                      <input
                        autoFocus
                        type="text"
                        aria-label="Editar respuesta"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") {
                            ev.preventDefault();
                            saveEdit();
                          }
                          if (ev.key === "Escape") cancelEditing();
                        }}
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-wit-ink outline-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="text-xs font-semibold text-wit-gray hover:text-wit-ink"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`relative self-end ${menuField === e.field ? "z-40" : ""}`}>
                    <div
                      onMouseDown={() => handlePressStart(e.field)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onMouseMove={handlePressMove}
                      onTouchStart={() => handlePressStart(e.field)}
                      onTouchEnd={handlePressEnd}
                      onTouchMove={handlePressMove}
                      onContextMenu={(ev) => ev.preventDefault()}
                      className="cursor-pointer select-none transition-transform active:scale-[0.97]"
                    >
                      {e.field === "colors" && e.answer !== "Omitido" ? (
                        <ColorsAnswerBubble value={e.answer} />
                      ) : (
                        <ChatBubble role="user" text={e.answer} />
                      )}
                    </div>
                    {menuField === e.field ? (
                      <div
                        ref={activeEditRef}
                        className="wit-rise absolute -top-11 right-0 flex items-center gap-1.5 rounded-xl bg-wit-ink px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(5,13,40,0.25)]"
                      >
                        <button
                          type="button"
                          onClick={() => startEditing(e.field, answers[e.field] ?? "")}
                          className="flex items-center gap-1.5"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          Editar
                        </button>
                        <span aria-hidden="true" className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-wit-ink" />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            {typing ? (
              <ChatBubble role="assistant" typingDots />
            ) : !done ? (
              <>
                <ChatBubble role="assistant" text={QUESTIONS[stepIndex].text} />
                {!QUESTIONS[stepIndex].required ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (listening) stopListening();
                      submitAnswer("");
                    }}
                    className="-mt-2 ml-8 self-start text-xs font-semibold text-wit-gray hover:text-wit-ink"
                  >
                    Omitir
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <ChatBubble
                  role="assistant"
                  text={loading ? "Generando tu solicitud..." : "¡Listo! Esto armé con tus respuestas:"}
                />
                {!loading ? (
                  <button
                    type="button"
                    onClick={restart}
                    className="-mt-2 ml-8 self-start text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
                  >
                    ↺ Nueva conversación
                  </button>
                ) : null}

                {fields ? (
                  <div className="wit-glass w-full rounded-2xl p-6 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
                    <h2 className="text-base font-bold text-wit-ink">Campos que llenó la IA</h2>
                    <dl className="mt-4 space-y-4">
                      <LabRow label="Título" value={fields.title} />
                      <LabRow label="Nombre comercial / empresa" value={fields.companyName} />
                      <LabRow label="Nombre del producto" value={fields.productName} />
                      <LabRow label="Categoría de negocio" value={fields.businessType} />
                      <LabRow label="A qué se dedica la empresa" value={fields.brief} />
                      <LabRow label="Qué quieres que salga en esta pieza" value={fields.pieceBrief} />
                      <LabRow label="Público objetivo" value={fields.audience} />
                      <LabRow label="Rango de edad" value={fields.ageRanges.join(", ")} />
                      <LabRow label="Precio o descuento" value={fields.promoPrice} />
                      <LabRow label="Mensaje o dato extra" value={fields.requiredText} />
                      <LabRow label="Estilo" value={fields.style} />
                      <LabRow label="Tipo de pieza" value={fields.pieceType} />
                      <LabRow label="Formato" value={fields.aspectRatio} />
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
                          Colores de marca
                        </dt>
                        <dd className="mt-1.5 flex gap-2">
                          {fields.colors.length ? (
                            fields.colors.map((c) => (
                              <span
                                key={c}
                                className="h-7 w-7 rounded-full border border-wit-ink/10"
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))
                          ) : (
                            <span className="text-sm text-wit-ink">—</span>
                          )}
                        </dd>
                      </div>
                    </dl>

                    {fields.missingInfo.length ? (
                      <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                          Le faltó preguntar
                        </p>
                        <ul className="mt-1.5 list-inside list-disc text-sm text-amber-800">
                          {fields.missingInfo.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-wit-ink/10 pb-6 pt-3">
          <div>{activeInput}</div>

          {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p> : null}

          <div className="mx-auto mt-4 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-wit-mist/50">
            <div
              className="h-full rounded-full bg-wit-blue transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, (stepIndex / QUESTIONS.length) * 100)}%` }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ChatBubble({
  role,
  text,
  typingDots,
}: {
  role: "assistant" | "user";
  text?: string;
  typingDots?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse self-end" : "self-start"}`}>
      {!isUser ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
          <WMark size={13} />
        </span>
      ) : null}
      <div
        className={`max-w-[230px] rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
          isUser ? "rounded-br-sm bg-wit-blue text-white" : "wit-glass rounded-bl-sm text-wit-ink"
        }`}
      >
        {typingDots ? (
          <div className="flex items-center gap-1 py-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray" />
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </div>
  );
}

// Mirrors ChatBubble's user-bubble shape, but swaps the text for the actual
// swatches the client picked — the point of the color picker was to keep
// the colors visible, not to collapse them back into a hex string.
function ColorsAnswerBubble({ value }: { value: string }) {
  const colors = value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return (
    // White (not bg-wit-blue like a normal user bubble) so a brand color
    // that happens to be WITERS blue still stands out instead of
    // disappearing into the bubble — but a plain white bubble reads as an
    // assistant message at a glance, so a blue border marks it as the
    // client's own answer instead.
    <div className="flex items-center gap-2 self-end rounded-2xl rounded-br-sm border-2 border-wit-blue bg-white px-4 py-2.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      {colors.map((c, i) => (
        <span
          key={i}
          title={c}
          className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(5,13,40,0.25)]"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function LabRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-wit-ink">{value || "—"}</dd>
    </div>
  );
}

// Plain pill chips, one tap = submit — there's no natural "shape" for a
// platform the way there is for an aspect ratio, so no preview needed here.
function PieceTypePicker({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="wit-glass flex flex-wrap justify-center gap-2 rounded-2xl p-3 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      {PIECE_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onPick(opt)}
          className="rounded-full bg-wit-mist/50 px-4 py-2 text-xs font-semibold text-wit-ink transition-transform hover:scale-[1.03] hover:bg-wit-mist active:scale-95"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// Tap a swatch, done — no popup, no confirm step, just pick the vibe that
// looks right.
function StylePicker({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 px-1 py-2">
      {STYLE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className="flex flex-col items-center gap-1.5 transition-transform hover:scale-[1.05] active:scale-95"
        >
          <span className={`h-12 w-12 rounded-xl shadow-[0_8px_20px_rgba(5,13,40,0.15)] ${opt.swatchClass}`} />
          <span className="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight text-wit-gray">
            {opt.value}
          </span>
        </button>
      ))}
    </div>
  );
}

// A vertical scroll-snap list standing in for a real 3D picker wheel —
// native scroll physics (flick, momentum, snap) for free, instead of
// hand-rolling drag/inertia math. Padding top/bottom equal to half the
// visible height lets the first/last item scroll to dead-center same as
// any other. Calls onSettle with whatever's centered ~140ms after
// scrolling stops, AND once on mount so the default (first item, before
// any scrolling) counts as a real selection too.
function WheelPicker({
  items,
  onSettle,
}: {
  items: string[];
  onSettle: (value: string, index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const centeredRef = useRef(0);
  const [centeredIndex, setCenteredIndex] = useState(0);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const padding = (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

  useEffect(() => {
    onSettleRef.current(items[0], 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
    if (index !== centeredRef.current) {
      centeredRef.current = index;
      setCenteredIndex(index);
      playWheelTick();
    }
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      onSettleRef.current(items[index], index);
    }, 140);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      aria-label="Selector"
      className="wit-wheel relative overflow-y-scroll"
      style={{ height: WHEEL_HEIGHT, width: 190, scrollSnapType: "y mandatory" }}
    >
      <div aria-hidden="true" style={{ height: padding }} />
      {items.map((item, i) => (
        <div
          key={item}
          style={{ height: WHEEL_ITEM_HEIGHT, scrollSnapAlign: "center" }}
          className={`flex items-center justify-center px-2 text-center transition-all duration-150 ${
            i === centeredIndex ? "text-sm font-bold text-wit-ink" : "text-xs font-medium text-wit-gray opacity-50"
          }`}
        >
          {item}
        </div>
      ))}
      <div aria-hidden="true" style={{ height: padding }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 border-y border-wit-blue/25"
        style={{ top: padding, height: WHEEL_ITEM_HEIGHT }}
      />
    </div>
  );
}

// Industry wheel first (short), then the specific-business-type wheel for
// that industry appears once it settles — "Otro" sits next to each wheel
// the whole time and swaps to a plain text field when tapped, at whichever
// level the client's business doesn't fit.
function BusinessTypeWheel({ onPick }: { onPick: (value: string) => void }) {
  const [industry, setIndustry] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [customStep, setCustomStep] = useState<"industry" | "type" | null>(null);
  const [customText, setCustomText] = useState("");

  if (customStep) {
    return (
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (customText.trim()) onPick(customText.trim());
        }}
        className="wit-glass mx-auto flex max-w-[280px] items-center gap-2 rounded-full p-1.5 pl-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
      >
        <input
          autoFocus
          type="text"
          aria-label="Tu categoría de negocio"
          value={customText}
          onChange={(ev) => setCustomText(ev.target.value)}
          placeholder="Escribe tu tipo de negocio..."
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-wit-ink outline-none placeholder:text-wit-gray"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          Enviar
        </button>
      </form>
    );
  }

  const industryEntry = BUSINESS_INDUSTRIES.find((i) => i.value === industry);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <WheelPicker
          items={BUSINESS_INDUSTRIES.map((i) => i.value)}
          onSettle={(value) => {
            setIndustry(value);
            setType(null);
          }}
        />
        <button
          type="button"
          onClick={() => setCustomStep("industry")}
          className="shrink-0 rounded-full bg-wit-mist/50 px-3 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          Otro
        </button>
      </div>

      {industryEntry ? (
        <div className="flex items-center gap-2">
          <WheelPicker key={industry} items={industryEntry.types} onSettle={setType} />
          <button
            type="button"
            onClick={() => setCustomStep("type")}
            className="shrink-0 rounded-full bg-wit-mist/50 px-3 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            Otro
          </button>
        </div>
      ) : null}

      {type ? (
        <button
          type="button"
          onClick={() => onPick(type)}
          className="rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          Confirmar
        </button>
      ) : null}
    </div>
  );
}

// Each ratio is its own small floating badge (same wit-float bob the WMark
// logo uses elsewhere) with just the number inside — the label sits below
// it, static, not bundled into one shared card the way the badges are.
// Laid out in one horizontal, scrollable line so nothing ever wraps into a
// grid.
function AspectRatioPicker({ onPick }: { onPick: (value: string) => void }) {
  return (
    // overflow-y-visible undoes the overflow-y:auto that overflow-x-auto
    // implies on its own — without it, the tallest badge's float bob got
    // clipped by this row's own box on every upswing.
    <div className="flex items-end justify-center gap-4 overflow-x-auto overflow-y-visible px-1 pb-2 pt-4">
      {ASPECT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className="flex shrink-0 flex-col items-center gap-1.5 transition-transform hover:scale-[1.05] active:scale-95"
        >
          {/* Two nested elements, not one — wit-float and wit-pending-glow
              each set the `animation` shorthand, so putting both classes
              on a single element let one silently overwrite the other
              (the ring never actually spun). Separate elements means both
              animations run at once: this one bobs, the one inside it
              spins its own ring. */}
          <div className="wit-float">
            {/* wit-pending-glow/-shield hardcode a 1rem radius (tuned for
                full-size request cards) — inline style overrides it here
                since unlayered CSS classes always beat Tailwind utilities,
                so a rounded-* class on this element wouldn't have won. */}
            <div
              className="wit-pending-glow w-10 shadow-[0_12px_28px_rgba(5,13,40,0.18)]"
              style={{ aspectRatio: opt.value.replace(":", " / "), borderRadius: "8px" }}
            >
              <div
                className="wit-pending-glow-shield flex h-full w-full items-center justify-center text-[10px] font-bold text-wit-blue"
                style={{ borderRadius: "6px" }}
              >
                {opt.value}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-wit-gray">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// Two steps (how many, then which) instead of one screen with three color
// wells always visible — a client with one brand color shouldn't have to
// stare at two empty pickers wondering what to do with them.
function ColorsPicker({ onPick }: { onPick: (value: string) => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  if (count === null) {
    return (
      <div className="wit-glass flex flex-col items-center gap-2.5 rounded-2xl px-4 py-3.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <p className="text-xs font-medium text-wit-gray">¿Cuántos colores de marca usas?</p>
        <div className="flex gap-2.5">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCount(n);
                setColors(Array.from({ length: n }, () => "#0047FF"));
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-wit-mist/60 text-sm font-bold text-wit-ink transition-transform hover:scale-105 hover:bg-wit-mist"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wit-glass flex flex-col items-center gap-3 rounded-2xl px-4 py-3.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex gap-3">
        {colors.map((c, i) => (
          <label key={i} className="flex flex-col items-center gap-1">
            <input
              type="color"
              aria-label={`Color ${i + 1}`}
              value={c}
              onChange={(ev) =>
                setColors((prev) => prev.map((x, idx) => (idx === i ? ev.target.value : x)))
              }
              className="h-10 w-10 cursor-pointer rounded-full border-2 border-white shadow-[0_2px_8px_rgba(5,13,40,0.15)]"
            />
            <span className="font-mono text-[10px] text-wit-gray">{c.toUpperCase()}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCount(null)}
          className="text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={() => onPick(colors.map((c) => c.toUpperCase()).join(", "))}
          className="rounded-full bg-wit-blue px-5 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

