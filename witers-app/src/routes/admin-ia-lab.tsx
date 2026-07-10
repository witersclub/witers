import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { WitersLogo } from "../components/witers/brand";

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
}

export const Route = createFileRoute("/admin-ia-lab")({
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
  const [transcript, setTranscript] = useState("");
  const [fields, setFields] = useState<Fields | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");

  async function generate(text: string) {
    if (text.trim().length < 5) return;
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

  function toggleMic() {
    setError(null);
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Tu navegador no soporta reconocimiento de voz — escribe el brief en el recuadro.");
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
      if (finalChunk) transcriptRef.current = (transcriptRef.current + " " + finalChunk).trim();
      setTranscript((transcriptRef.current + " " + interim).trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== "no-speech") {
        setError("No pudimos usar el micrófono. Revisa los permisos del navegador.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      if (transcriptRef.current.trim().length >= 5) {
        void generate(transcriptRef.current);
      }
    };
    transcriptRef.current = transcript;
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
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

      <main
        className={
          fields
            ? "mx-auto max-w-lg px-5 py-10"
            : "mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col items-center justify-center px-5 py-10 text-center"
        }
      >
        <h1 className="text-2xl font-extrabold tracking-tighter text-wit-ink">
          ¿Qué pieza quieres crear <span className="text-wit-blue">hoy</span>?
        </h1>

        <div className="wit-glass mt-6 w-full rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
          <textarea
            aria-label="Brief del cliente"
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Escribe o presiona el micrófono para hablar..."
            className="w-full resize-none rounded-xl border-0 bg-transparent px-1 py-1 text-center text-base text-wit-ink outline-none placeholder:text-wit-gray"
          />
        </div>

        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "Detener grabación" : "Activar micrófono"}
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
        <p className="mt-2 text-xs text-wit-gray">
          {listening ? "Escuchando... presiona de nuevo para terminar" : "Toca para hablar"}
        </p>

        {transcript.trim().length >= 5 && !listening ? (
          <button
            type="button"
            onClick={() => generate(transcript)}
            disabled={loading}
            className="mt-3 text-sm font-semibold text-wit-blue hover:text-wit-blue-deep disabled:opacity-50"
          >
            {loading ? "Generando..." : "Generar →"}
          </button>
        ) : null}

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

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
