import { useEffect, useRef, useState } from "react";

import { useLanguage } from "../../lib/i18n";

// The Web Speech API has no official TS lib entry — same minimal shape
// chat-intake.tsx declares for its own (more complex, multi-question) mic
// flow. This is the simple version: one plain text field, dictate straight
// into whatever's already there.
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

// A small mic toggle to drop inside any textarea/input wrapper (position it
// with the `className` prop — e.g. "absolute bottom-2 right-2"). Dictation
// appends to whatever text is already there rather than replacing it, and
// never submits anything itself — the caller's own send/save button does
// that, same reasoning as the AI chat's composer.
export function MicButton({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const { t, lang } = useLanguage();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const manualStopRef = useRef(false);
  // How many entries of the *current* recognition session's own results
  // array have already been folded into baseRef — our own forward-only
  // pointer, never trusting event.resultIndex. Some Android speech engines
  // don't advance resultIndex correctly and instead keep re-firing onresult
  // with the results array replayed from 0, re-marking already-finalized
  // entries as final again; trusting resultIndex there re-appends the same
  // finalized chunk into baseRef every time, producing runaway duplicated
  // text ("Crea Crea una Crea una imagen..."). Reset to 0 whenever a fresh
  // recognition session starts, since a new instance starts its own results
  // array over at index 0.
  const finalizedCountRef = useRef(0);
  // Tracks the last value *we* pushed via onChange, so the effect below can
  // tell "the parent changed value out from under us" (manual typing while
  // idle, or clearing the field after sending) apart from just seeing back
  // the value we ourselves just emitted.
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  // Keeps dictation honest whenever the field changes for a reason that
  // didn't come from us — most importantly, the caller clearing it right
  // after sending. Without this, a still-listening mic keeps building on
  // its own stale internal copy of the text and stomps the just-cleared
  // field with what was already sent as soon as the next speech event
  // fires. If the field was cleared out while we're still listening,
  // there's nothing left to dictate onto for a message that already went
  // out, so stop instead of continuing to accumulate into a dead session.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    baseRef.current = value;
    lastEmittedRef.current = value;
    if (value === "" && listening) stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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

  // Resumes/continues an in-progress dictation — used both for the first
  // start and for Chrome's own automatic reconnects (a long or idle
  // continuous session can end on its own). Deliberately never re-syncs
  // baseRef from the `value` prop: only reads baseRef.current (a ref, so
  // never stale across renders) and appends to it, so an automatic
  // reconnect can never discard what's already been dictated.
  function startRecognition() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    manualStopRef.current = false;
    finalizedCountRef.current = 0;
    const recognition = new Ctor();
    // Hardcoded "es-MX" here made English dictation on an English-language
    // session silently produce nothing — most speech engines don't error
    // out on a language mismatch, they just return empty/junk transcripts.
    recognition.lang = lang === "en" ? "en-US" : "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = finalizedCountRef.current; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          baseRef.current = (baseRef.current + " " + r[0].transcript).trim();
          finalizedCountRef.current = i + 1;
        } else {
          interim += r[0].transcript;
        }
      }
      const next = (baseRef.current + " " + interim).trim();
      lastEmittedRef.current = next;
      onChange(next);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      manualStopRef.current = true;
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      if (!manualStopRef.current) startRecognition();
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  // The button's own entry point — syncs baseRef from whatever's currently
  // in the field (text typed by hand, or a fresh/cleared field) before
  // beginning a new dictation session.
  function startListening() {
    baseRef.current = value;
    startRecognition();
  }

  return (
    <button
      type="button"
      onClick={() => (listening ? stopListening() : startListening())}
      aria-label={
        listening
          ? t("Detener micrófono", "Stop microphone")
          : t("Dictar por voz", "Dictate by voice")
      }
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
        listening
          ? "animate-pulse bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
          : "bg-wit-blue text-white hover:bg-wit-blue-deep"
      } ${className}`}
    >
      <svg
        width="14"
        height="14"
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
  );
}
