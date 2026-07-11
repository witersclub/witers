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
// them (style → chip, colors → hex, aspectRatio → enum) same as before.
const QUESTIONS: { field: string; label: string; short: string; text: string; required: boolean }[] = [
  {
    field: "companyName",
    label: "Empresa",
    short: "Empresa",
    text: "¿Cuál es el nombre de tu empresa o marca?",
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
    field: "style",
    label: "Estilo",
    short: "Estilo",
    text: "¿Qué estilo visual te gustaría? Ej. minimalista, colorido, elegante...",
    required: false,
  },
  {
    field: "aspectRatio",
    label: "Formato",
    short: "Formato",
    text: "¿Para dónde es esta pieza — post cuadrado, historia vertical, banner horizontal?",
    required: false,
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
  {
    field: "colors",
    label: "Colores de marca",
    short: "Colores",
    text: "¿Tienes colores de marca que debamos usar? Descríbelos, o dime que no tienes.",
    required: false,
  },
];

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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);

  const done = stepIndex >= QUESTIONS.length;

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

  async function generate(text: string) {
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
      setFields(data.fields);
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
        void generate(buildTranscript(nextAnswers));
      }
    }, 550);
  }
  submitAnswerRef.current = submitAnswer;

  function restart() {
    stopListening();
    setAnswers({});
    setStepIndex(0);
    setCurrentAnswer("");
    setFields(null);
    setError(null);
    setTyping(false);
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

      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col items-center px-5 pb-10 text-center">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm font-medium text-wit-ink">Creemos tu pieza juntos</p>
        </div>

        <div className="flex flex-col items-center pb-6 mb-[2cm]">
        <div className="wit-float">
          <WMark size={32} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (listening) stopListening();
            submitAnswer(currentAnswer);
          }}
          className="wit-glass mt-4 w-full rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]"
        >
          <input
            type="text"
            aria-label="Tu respuesta"
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={done}
            placeholder={done ? "" : "Escribe o presiona el micrófono..."}
            className="w-full rounded-xl border-0 bg-transparent px-1 py-1 text-center text-base text-wit-ink outline-none placeholder:text-wit-gray disabled:opacity-50"
          />
        </form>

        {!done ? (
          <>
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Detener micrófono" : "Activar micrófono"}
              className={`mt-4 flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                listening
                  ? "animate-pulse bg-red-500 text-white shadow-[0_0_0_8px_rgba(239,68,68,0.15)]"
                  : "bg-wit-blue text-white hover:bg-wit-blue-deep"
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
              </svg>
            </button>
            {listening ? (
              <p className="mt-1.5 text-[11px] text-wit-gray">Te escucho — sigue hablando, yo voy avanzando</p>
            ) : null}
          </>
        ) : (
          <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        <div key={typing ? `typing-${stepIndex}` : `q-${stepIndex}`} className="mt-4 min-h-[3rem] animate-in fade-in slide-in-from-bottom-2 duration-300">
          {typing ? (
            <div className="flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wit-gray" />
            </div>
          ) : done ? (
            <div>
              <p className="text-sm font-semibold text-wit-ink">
                {loading ? "Generando tu solicitud..." : "¡Listo! Esto armé con tus respuestas:"}
              </p>
              {!loading ? (
                <button type="button" onClick={restart} className="mt-1 text-xs font-semibold text-wit-blue hover:text-wit-blue-deep">
                  ↺ Nueva conversación
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-wit-ink">{QUESTIONS[stepIndex]?.text}</p>
              {!QUESTIONS[stepIndex]?.required ? (
                <button
                  type="button"
                  onClick={() => {
                    if (listening) stopListening();
                    submitAnswer("");
                  }}
                  className="mt-1 text-xs font-semibold text-wit-gray hover:text-wit-ink"
                >
                  Omitir
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-1.5">
          {QUESTIONS.map((q) => {
            const isAnswered = Object.prototype.hasOwnProperty.call(answers, q.field);
            return (
              <span
                key={q.field}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-300 ${
                  isAnswered
                    ? "bg-wit-blue text-white"
                    : "bg-wit-mist/50 text-wit-gray"
                }`}
              >
                {isAnswered ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
                {q.short}
              </span>
            );
          })}
        </div>

        {error ? <p className="mt-3 w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

        {fields ? (
          <div className="wit-glass mt-6 w-full rounded-2xl p-6 text-left shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
            <h2 className="text-base font-bold text-wit-ink">Campos que llenó la IA</h2>
            <dl className="mt-4 space-y-4">
              <LabRow label="Título" value={fields.title} />
              <LabRow label="Nombre comercial / empresa" value={fields.companyName} />
              <LabRow label="Nombre del producto" value={fields.productName} />
              <LabRow label="A qué se dedica la empresa" value={fields.brief} />
              <LabRow label="Qué quieres que salga en esta pieza" value={fields.pieceBrief} />
              <LabRow label="Público objetivo" value={fields.audience} />
              <LabRow label="Rango de edad" value={fields.ageRanges.join(", ")} />
              <LabRow label="Precio o descuento" value={fields.promoPrice} />
              <LabRow label="Mensaje o dato extra" value={fields.requiredText} />
              <LabRow label="Estilo" value={fields.style} />
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
        </div>
      </main>
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

