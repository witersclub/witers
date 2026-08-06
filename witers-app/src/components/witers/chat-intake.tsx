import { useEffect, useRef, useState } from "react";

import { useLanguage } from "../../lib/i18n";
import { WMark } from "./brand";
import { ensureGoogleFontLoaded } from "./google-font-picker";

// The full conversational "intake" engine shared by the admin lab
// (admin-lab.tsx) and the real member-facing chat (panel.tsx) — mic
// dictation, typing indicator, press-and-hold-to-edit answer bubbles, the
// not-started/started layout switch. Both routes ask the same style of
// one-question-at-a-time flow but diverge on what happens once every
// question is answered (admin-lab hands the transcript to an AI-fill
// endpoint; the member panel goes straight to a review screen), so that
// part is left to the caller via onComplete/pending/resultSlot instead of
// living in here.

// The Web Speech API has no official TS lib entry — declare just the
// pieces used rather than pulling in a whole @types package for one file.
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

export type ChatQuestion = { field: string; text: string; required: boolean };

// Skips forward past any question whose field already has a known answer
// (from initialAnswers, e.g. handed off from the homepage teaser) — not
// just a leading run, since a pre-answered field can sit between two
// questions that still need asking.
function advancePastKnown(
  questions: ChatQuestion[],
  startIndex: number,
  knownAnswers: Record<string, string>,
): number {
  let idx = startIndex;
  while (idx < questions.length && questions[idx].field in knownAnswers) idx++;
  return idx;
}

export function ChatBubble({
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

// Same idea as ColorsAnswerBubble below, for WitConversation's reference-
// photo attachments (panel.tsx) — before this, an uploaded photo collapsed
// into a plain confirmation line ("Adjunté 2 fotos...") with no visual
// trace of what was actually attached, so scrolling back gave no way to
// confirm it really went through. Now the thumbnails stay pinned to the
// message permanently instead of only living in the temporary staging
// strip above the composer while it's being typed.
export function PhotosAnswerBubble({
  photoKeys,
  caption,
}: {
  photoKeys: string[];
  caption: string;
}) {
  return (
    <div className="max-w-[230px] self-end rounded-2xl rounded-br-sm bg-wit-blue px-3 py-2.5 text-sm text-white">
      <p className="px-0.5 pb-2 leading-relaxed">{caption}</p>
      <div className="flex flex-wrap gap-1.5">
        {photoKeys.map((key) => (
          <img
            key={key}
            src={`/api/file?key=${encodeURIComponent(key)}`}
            alt=""
            className="h-16 w-16 rounded-xl border border-white/20 object-cover"
          />
        ))}
      </div>
    </div>
  );
}

// Mirrors ChatBubble's user-bubble shape, but swaps the text for the actual
// swatches the client picked — the point of the color picker was to keep
// the colors visible, not to collapse them back into a hex string.
export function ColorsAnswerBubble({ value }: { value: string }) {
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

// Same idea as ColorsAnswerBubble — for a client who picked a Google Fonts
// library font (FontChoicePicker's "library:<family>" tag) instead of
// uploading their own files, the bubble renders the family name in that
// actual font rather than a plain confirmation line.
function FontAnswerBubble({ family }: { family: string }) {
  useEffect(() => {
    ensureGoogleFontLoaded(family);
  }, [family]);
  return (
    <div className="flex flex-col gap-0.5 self-end rounded-2xl rounded-br-sm border-2 border-wit-blue bg-white px-4 py-2.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <span className="text-lg text-wit-ink" style={{ fontFamily: `"${family}", sans-serif` }}>
        {family}
      </span>
    </div>
  );
}

export function ChatIntakeFlow({
  questions,
  pickerFor,
  onComplete,
  pending = false,
  pendingLabel,
  doneLabel,
  resultSlot = null,
  restart,
  externalError = null,
  eyebrow,
  onClose,
  initialAnswers,
  onAnswer,
}: {
  questions: ChatQuestion[];
  // null means "no dedicated picker for this field" — falls back to the
  // generic type-or-speak composer below. `onPick` is this flow's own
  // submitAnswer, handed down so the caller's picker can advance the
  // conversation without needing access to internal state.
  pickerFor: (field: string, onPick: (value: string) => void) => React.ReactNode | null;
  // Called once every question has an answer, and again any time an
  // already-answered field is edited after that point — always with the
  // complete, current answer set.
  onComplete: (answers: Record<string, string>) => void;
  pending?: boolean;
  pendingLabel?: string;
  doneLabel?: string;
  resultSlot?: React.ReactNode;
  restart?: () => void;
  externalError?: string | null;
  eyebrow?: string;
  onClose?: () => void;
  // Answers already known before the conversation starts (e.g. handed off
  // from the homepage teaser) — their questions are never asked, but still
  // render as already-answered bubbles, same as anything answered in this
  // session, editable the same way via press-and-hold.
  initialAnswers?: Record<string, string>;
  // Fired with the full current answer set after every answer (new or
  // edited) — used to autosave progress (e.g. the mandatory brand-
  // onboarding chat) without needing a separate persistence path bolted
  // onto submitAnswer/saveEdit.
  onAnswer?: (answers: Record<string, string>) => void;
}) {
  const { t, lang } = useLanguage();
  const resolvedPendingLabel = pendingLabel ?? t("Un momento...", "One moment...");
  const resolvedDoneLabel = doneLabel ?? t("¡Listo!", "Done!");
  const resolvedEyebrow = eyebrow ?? t("Hagamos tu pieza juntos", "Let's make your piece together");
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...initialAnswers }));
  const [stepIndex, setStepIndex] = useState(() =>
    advancePastKnown(questions, 0, initialAnswers ?? {}),
  );
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuField, setMenuField] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerRef = useRef("");
  const manualStopRef = useRef(false);
  // Our own forward-only pointer into the *current* recognition session's
  // results array — never trusts event.resultIndex. Some Android speech
  // engines don't advance resultIndex correctly and instead re-fire
  // onresult with the whole results array replayed from 0, re-marking
  // already-finalized entries as final again; trusting resultIndex there
  // re-appends the same finalized chunk into answerRef every time,
  // producing runaway duplicated text ("Crea Crea una Crea una imagen...").
  // Reset to 0 whenever a fresh recognition session starts.
  const finalizedCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<number | null>(null);
  const pressMovedRef = useRef(false);
  const activeEditRef = useRef<HTMLDivElement>(null);

  const done = stepIndex >= questions.length;
  // The full chat view only takes over the screen once the first answer is
  // sent — before that it's a small, centered composer, closer to how
  // ChatGPT/Claude start before the first message.
  const started = stepIndex > 0;

  // Chat transcript built from questions already answered, in order —
  // derived straight from `answers`/`stepIndex` instead of a separate
  // messages array, so there's nothing extra to keep in sync.
  const answeredEntries = questions.slice(0, stepIndex).map((q) => ({
    field: q.field,
    question: q.text,
    answer: (answers[q.field] ?? "").trim() || t("Omitido", "Skipped"),
  }));

  // Keep the conversation scrolled to the latest message as it grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [stepIndex, typing, done, pending, resultSlot]);

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

  // Don't leave the mic listening in the background if the client leaves —
  // covers both an in-app navigation (React unmount) and a hard exit
  // (closing the tab, typing a new URL), which unmount alone won't catch.
  // abort() cuts the mic immediately instead of stop()'s graceful, slightly
  // delayed wind-down.
  useEffect(() => {
    const killMic = () => {
      manualStopRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
    window.addEventListener("pagehide", killMic);
    return () => {
      window.removeEventListener("pagehide", killMic);
      killMic();
    };
  }, []);

  // recognition.onend (below) needs to know whether we're done without
  // closing over a stale value — kept in sync every render.
  const doneRef = useRef(done);
  doneRef.current = done;

  function submitAnswer(rawText: string) {
    const q = questions[stepIndex];
    if (!q || done) return;
    const text = rawText.trim();
    if (!text && q.required) {
      setError(t("Este dato es necesario para continuar.", "This field is required to continue."));
      return;
    }
    setError(null);
    const nextAnswers = { ...answers, [q.field]: text };
    setAnswers(nextAnswers);
    setCurrentAnswer("");
    answerRef.current = "";
    onAnswer?.(nextAnswers);
    const nextIndex = advancePastKnown(questions, stepIndex + 1, nextAnswers);
    setStepIndex(nextIndex);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (nextIndex >= questions.length) onComplete(nextAnswers);
    }, 550);
  }

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
  // of the conversation.
  function saveEdit() {
    const field = editingField;
    if (!field) return;
    const q = questions.find((x) => x.field === field);
    const text = editValue.trim();
    if (q?.required && !text) {
      setError(t("Este dato es necesario para continuar.", "This field is required to continue."));
      return;
    }
    setError(null);
    const nextAnswers = { ...answers, [field]: text };
    setAnswers(nextAnswers);
    setEditingField(null);
    setEditValue("");
    onAnswer?.(nextAnswers);
    if (done) onComplete(nextAnswers);
  }

  // Stops the mic outright — used when the client presses the mic to pause
  // dictation, submits an answer, or leaves the page. Never submits by
  // itself: the transcript stays in currentAnswer until the client presses
  // Enviar, so a pause mid-thought never gets cut off and attributed to the
  // wrong question.
  function stopListening() {
    manualStopRef.current = true;
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

  function startListening() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError(
        t(
          "Tu navegador no soporta reconocimiento de voz — escribe tu respuesta.",
          "Your browser doesn't support voice recognition — type your answer instead.",
        ),
      );
      return;
    }
    finalizedCountRef.current = 0;
    const recognition = new Ctor();
    // Hardcoded "es-MX" here made English dictation silently produce
    // nothing (see mic-button.tsx's identical fix for the same bug).
    recognition.lang = lang === "en" ? "en-US" : "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = finalizedCountRef.current; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          answerRef.current = (answerRef.current + " " + r[0].transcript).trim();
          finalizedCountRef.current = i + 1;
        } else {
          interim += r[0].transcript;
        }
      }
      setCurrentAnswer((answerRef.current + " " + interim).trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      manualStopRef.current = true;
      setListening(false);
      setError(
        t(
          "No pudimos usar el micrófono. Revisa los permisos del navegador.",
          "We couldn't use the microphone. Check your browser permissions.",
        ),
      );
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

  // Toggling the mic only starts/pauses dictation — it never submits. The
  // client decides when an answer is finished by pressing Enviar, which
  // stays available (alongside the mic) for as long as there's text.
  function toggleMic() {
    setError(null);
    if (listening) {
      stopListening();
      return;
    }
    manualStopRef.current = false;
    answerRef.current = currentAnswer;
    startListening();
  }

  const showSend = currentAnswer.trim().length > 0;
  const showMicToggle = !showSend || listening;

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
          aria-label={t("Tu respuesta", "Your answer")}
          value={currentAnswer}
          onChange={(e) => {
            // Keep the ref the mic's onresult callback builds on top of in
            // sync with manual edits too — otherwise, if the mic is still
            // listening in the background while the client types by hand,
            // the next speech event (even just background noise) overwrites
            // whatever they just typed with stale dictation state.
            answerRef.current = e.target.value;
            setCurrentAnswer(e.target.value);
          }}
          disabled={done}
          placeholder={
            done ? "" : t("Escribe o presiona el micrófono...", "Type or press the microphone...")
          }
          // text-base (16px), not text-sm — iOS Safari auto-zooms the whole
          // page on focus for any input under 16px, forcing an awkward
          // manual pinch-to-zoom-out afterward.
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-base text-wit-ink outline-none placeholder:text-wit-gray disabled:opacity-50"
        />
        {done ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            {showMicToggle ? (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={
                  listening
                    ? t("Pausar micrófono", "Pause microphone")
                    : t("Activar micrófono", "Turn on microphone")
                }
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                  listening
                    ? "animate-pulse bg-red-500 text-white shadow-[0_0_0_6px_rgba(239,68,68,0.15)]"
                    : "bg-wit-blue text-white hover:bg-wit-blue-deep"
                }`}
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
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </svg>
              </button>
            ) : null}
            {showSend ? (
              <button
                type="submit"
                aria-label={t("Enviar respuesta", "Send answer")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white transition-all hover:bg-wit-blue-deep"
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
            ) : null}
          </div>
        )}
      </form>
      {listening ? (
        <p className="mt-1.5 text-center text-[11px] text-wit-gray">
          {showSend
            ? t(
                "Te escucho — sigue hablando o pulsa enviar cuando termines",
                "I'm listening — keep talking or tap send when you're done",
              )
            : t("Te escucho — sigue hablando", "I'm listening — keep talking")}
        </p>
      ) : null}
    </>
  );

  // Structured fields (pieceType, aspectRatio, colors, style, businessType,
  // audience, ageRanges, logoKey, productPhotoKey) get a dedicated visual
  // picker instead of the text/mic composer — easier than asking a client
  // to describe a hex color or an aspect ratio out loud, and it removes any
  // need to guess those values from free text afterward.
  const currentQuestion = questions[stepIndex];
  const activeInput = currentQuestion
    ? (pickerFor(currentQuestion.field, submitAnswer) ?? composer)
    : composer;
  const shownError = error ?? externalError;

  if (!started) {
    return (
      <div className="relative flex h-full min-h-0 flex-col items-center justify-center px-1 text-center">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Cerrar chat", "Close chat")}
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
          >
            ×
          </button>
        ) : null}
        <div className="wit-float">
          <WMark size={32} />
        </div>
        <p className="mt-3 text-base font-medium text-wit-ink">{resolvedEyebrow}</p>
        <p className="mt-2 text-sm text-wit-gray">{questions[0]?.text}</p>

        {shownError ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{shownError}</p>
        ) : null}

        <div className="mt-6 w-full">{activeInput}</div>
        {questions[0] && !questions[0].required ? (
          <button
            type="button"
            onClick={() => submitAnswer("")}
            className="mt-3 text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            {t("Omitir", "Skip")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="wit-rise flex h-full min-h-0 flex-col">
      <div className="relative flex flex-col items-center gap-1.5 pb-1 pt-1">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Cerrar chat", "Close chat")}
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
          >
            ×
          </button>
        ) : null}
        <div className="wit-float">
          <WMark size={26} />
        </div>
        <p className="text-sm font-medium text-wit-ink">{resolvedEyebrow}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 py-4">
          {answeredEntries.map((e) => (
            <div key={e.field} className="flex flex-col gap-3">
              <ChatBubble role="assistant" text={e.question} />
              {editingField === e.field ? (
                <div
                  ref={activeEditRef}
                  className="relative z-40 flex flex-col items-end gap-1.5 self-end"
                >
                  <div className="flex w-full max-w-[230px] items-center rounded-2xl rounded-br-sm border-2 border-wit-blue bg-white px-3.5 py-2">
                    <input
                      autoFocus
                      type="text"
                      aria-label={t("Editar respuesta", "Edit answer")}
                      value={editValue}
                      onChange={(ev) => setEditValue(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          saveEdit();
                        }
                        if (ev.key === "Escape") cancelEditing();
                      }}
                      className="min-w-0 flex-1 border-0 bg-transparent text-base text-wit-ink outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-xs font-semibold text-wit-gray hover:text-wit-ink"
                    >
                      {t("Cancelar", "Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
                    >
                      {t("Guardar", "Save")}
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
                    ) : e.field === "fontKeys" &&
                      e.answer !== "Omitido" &&
                      e.answer.startsWith("library:") ? (
                      // FontChoicePicker tags a Google Fonts pick as
                      // "library:<family>" — shown in that actual font
                      // instead of a plain confirmation line.
                      <FontAnswerBubble family={e.answer.slice("library:".length)} />
                    ) : e.field === "fontKeys" && e.answer !== "Omitido" ? (
                      // The raw comma-joined R2 keys ("upload:<keys>", or
                      // bare keys from before FontChoicePicker tagged
                      // things) aren't something a client should ever have
                      // to read — a plain count reads as a real
                      // confirmation instead.
                      <ChatBubble
                        role="user"
                        text={t(
                          `${
                            e.answer
                              .replace(/^upload:/, "")
                              .split(",")
                              .filter(Boolean).length
                          } archivo(s) de tipografía subidos.`,
                          `${
                            e.answer
                              .replace(/^upload:/, "")
                              .split(",")
                              .filter(Boolean).length
                          } font file(s) uploaded.`,
                        )}
                      />
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
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                        {t("Editar", "Edit")}
                      </button>
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-wit-ink"
                      />
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
              <ChatBubble role="assistant" text={currentQuestion.text} />
              {!currentQuestion.required ? (
                <button
                  type="button"
                  onClick={() => {
                    if (listening) stopListening();
                    submitAnswer("");
                  }}
                  className="-mt-2 ml-8 self-start text-xs font-semibold text-wit-gray hover:text-wit-ink"
                >
                  {t("Omitir", "Skip")}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <ChatBubble
                role="assistant"
                text={pending ? resolvedPendingLabel : resolvedDoneLabel}
              />
              {!pending && restart ? (
                <button
                  type="button"
                  onClick={restart}
                  className="-mt-2 ml-8 self-start text-xs font-semibold text-wit-blue hover:text-wit-blue-deep"
                >
                  ↺ {t("Nueva conversación", "New conversation")}
                </button>
              ) : null}
              {!pending ? resultSlot : null}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-wit-ink/10 pb-4 pt-3">
        <div>{activeInput}</div>

        {shownError ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
            {shownError}
          </p>
        ) : null}

        <div className="mx-auto mt-4 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-wit-mist/50">
          <div
            className="h-full rounded-full bg-wit-blue transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, (stepIndex / questions.length) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
