import { useEffect, useRef, useState } from "react";

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
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const manualStopRef = useRef(false);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

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
    if (!Ctor) return;
    manualStopRef.current = false;
    baseRef.current = value;
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
      if (finalChunk) baseRef.current = (baseRef.current + " " + finalChunk).trim();
      onChange((baseRef.current + " " + interim).trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      manualStopRef.current = true;
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      if (!manualStopRef.current) startListening();
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={() => (listening ? stopListening() : startListening())}
      aria-label={listening ? "Detener micrófono" : "Dictar por voz"}
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
