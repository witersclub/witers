// Client-facing "solicitudes de video" — the video counterpart of
// panel.tsx's image-request flow (Grow/Scale already sell "2/4 videos" in
// membership-plans.ts, this is what actually fulfills it). Deliberately
// self-contained (own query, own portal-mounted wizard) so it can be
// dropped into a panel.tsx section the same way CampanasPanel is, without
// growing that already-large file further.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Clapperboard,
  Download,
  Facebook,
  Instagram,
  Loader2,
  Music2,
  Pencil,
  Sparkles,
  Upload,
  Video as VideoIcon,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";

import { ChatBubble } from "./chat-intake";
import { MicButton } from "./mic-button";

type VideoRequestRow = {
  id: string;
  status: string;
  title: string;
  purpose: string;
  platform: string;
  aspect_ratio: string;
  duration_target: string | null;
  tone: string | null;
  music_mood: string | null;
  wants_ai_scenes: number;
  ai_scenes_note: string | null;
  admin_note: string | null;
  delivered_key: string | null;
  delivered_at: string | null;
  created_at: string;
  raw_files_json: string | null;
};

type RawFile = { id: string; original_name: string; r2_key: string };

function parseRawFiles(row: VideoRequestRow): RawFile[] {
  if (!row.raw_files_json) return [];
  try {
    return (JSON.parse(row.raw_files_json) as RawFile[]).filter((f) => f.id);
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  nueva: { label: "En cola", cls: "bg-amber-50 text-amber-700" },
  en_proceso: { label: "En edición", cls: "bg-amber-50 text-amber-700" },
  completada: { label: "Listo", cls: "bg-emerald-50 text-emerald-700" },
  rechazada: { label: "Rechazada", cls: "bg-red-50 text-red-600" },
};

const PLATFORM_OPTIONS: { id: string; label: string; aspect: string; icon: LucideIcon }[] = [
  { id: "instagram", label: "Instagram", aspect: "9:16", icon: Instagram },
  { id: "tiktok", label: "TikTok", aspect: "9:16", icon: Music2 },
  { id: "youtube", label: "YouTube", aspect: "16:9", icon: Youtube },
  { id: "facebook", label: "Facebook", aspect: "1:1", icon: Facebook },
  { id: "otro", label: "Otro", aspect: "9:16", icon: Clapperboard },
];

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function VideoRequestsPanel({
  active,
  quotaUsed,
  quotaTotal,
}: {
  active: boolean;
  quotaUsed: number;
  quotaTotal: number;
}) {
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const query = useQuery({
    queryKey: ["video-requests"],
    queryFn: async () => {
      const res = await fetch("/api/video-requests", { credentials: "include" });
      if (!res.ok) return { ok: false, videoRequests: [] as VideoRequestRow[] };
      return (await res.json()) as { ok: boolean; videoRequests: VideoRequestRow[] };
    },
  });

  const rows = query.data?.videoRequests ?? [];
  const remaining = quotaTotal - quotaUsed;

  return (
    <section>
      <div className="wit-glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <div>
          <p className="text-lg font-bold text-wit-ink">Solicitudes de video</p>
          <p className="mt-1 text-sm text-wit-gray">
            {quotaTotal > 0
              ? `${quotaUsed} de ${quotaTotal} videos usados este mes.`
              : "Tu plan actual no incluye videos."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          disabled={!active || quotaTotal === 0 || remaining <= 0}
          className="flex items-center gap-1.5 rounded-full bg-wit-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-wit-blue-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <VideoIcon className="h-4 w-4" strokeWidth={2.3} />
          Nueva solicitud de video
        </button>
      </div>

      {quotaTotal === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-wit-ink/15 p-6 text-center">
          <p className="text-sm text-wit-gray">
            Los planes Grow y Scale incluyen videos para redes sociales.
          </p>
          <a
            href="/upgrade"
            className="mt-3 inline-block rounded-full bg-wit-blue px-5 py-2.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
          >
            Ver planes
          </a>
        </div>
      ) : remaining <= 0 ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          Ya usaste tus videos disponibles este mes. Vuelven a estar disponibles en tu próximo
          ciclo.
        </p>
      ) : null}

      <div className="mt-6">
        {query.isLoading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="wit-glass rounded-3xl border border-dashed border-wit-ink/15 p-10 text-center">
            <p className="text-base font-semibold text-wit-ink">
              Aún no tienes solicitudes de video.
            </p>
            <p className="mt-1 text-sm text-wit-gray">
              Sube tu metraje y cuéntanos qué necesitas — nosotros lo editamos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <VideoEntry key={r.id} row={r} />
            ))}
          </div>
        )}
      </div>

      {wizardOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-white">
              <VideoWizard
                onClose={() => setWizardOpen(false)}
                onCreated={() => {
                  void qc.invalidateQueries({ queryKey: ["video-requests"] });
                  void qc.invalidateQueries({ queryKey: ["me"] });
                  setWizardOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function VideoEntry({ row }: { row: VideoRequestRow }) {
  const st = STATUS_LABEL[row.status] ?? STATUS_LABEL.nueva;
  const platform = PLATFORM_OPTIONS.find((p) => p.id === row.platform);
  const rawFiles = parseRawFiles(row);

  return (
    <div className="wit-glass rounded-2xl p-5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {platform ? (
              <platform.icon className="h-4 w-4 shrink-0 text-wit-gray" strokeWidth={2} />
            ) : null}
            <p className="truncate text-sm font-bold text-wit-ink">{row.title}</p>
          </div>
          <p className="mt-1 text-xs text-wit-gray">
            {row.aspect_ratio} · {rawFiles.length} archivo{rawFiles.length === 1 ? "" : "s"} subido
            {rawFiles.length === 1 ? "" : "s"} ·{" "}
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

      {row.status === "completada" && row.delivered_key ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-wit-ink/10">
          <video
            controls
            preload="metadata"
            className="max-h-72 w-full bg-black"
            src={`/api/file?key=${encodeURIComponent(row.delivered_key)}`}
          />
          <a
            href={`/api/file?key=${encodeURIComponent(row.delivered_key)}&download=1`}
            className="flex items-center justify-center gap-1.5 border-t border-wit-ink/10 bg-white py-2.5 text-xs font-bold text-wit-blue hover:bg-wit-mist/40"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.3} />
            Descargar video
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- wizard ---------- */

type UploadedFile = { name: string; key: string; status: "uploading" | "done" | "error" };

function VStep({
  qIndex,
  total,
  icon: Icon,
  question,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Siguiente",
  nextDisabled = false,
}: {
  qIndex: number;
  total: number;
  icon: LucideIcon;
  question: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col px-5 py-8">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
          Paso {qIndex + 1} de {total}
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-wit-ink">
          <Icon className="h-6 w-6 text-wit-blue" strokeWidth={1.75} /> {question}
        </h2>
        {subtitle ? <p className="mt-1 text-xs text-wit-gray">{subtitle}</p> : null}
      </div>
      <div className="flex-1">{children}</div>
      <div className="mt-6 flex items-center gap-3">
        {qIndex > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-wit-gray hover:text-wit-ink"
          >
            ← Atrás
          </button>
        ) : null}
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="ml-auto rounded-full bg-wit-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-40"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// "composing": client is typing/dictating their raw idea to Wit.
// "thinking": waiting on /api/wit-video-idea.
// "reviewing": Wit replied with a structured title+purpose, shown editable
// before moving on. "manual": classic two-field form, either chosen
// directly or landed on after Wit failed to respond.
type IdeaStage = "composing" | "thinking" | "reviewing" | "manual";

function VideoWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [ideaStage, setIdeaStage] = useState<IdeaStage>("composing");
  const [ideaText, setIdeaText] = useState("");
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [durationTarget, setDurationTarget] = useState("");
  const [tone, setTone] = useState("");
  const [musicMood, setMusicMood] = useState("");
  const [wantsAiScenes, setWantsAiScenes] = useState(false);
  const [aiScenesNote, setAiScenesNote] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = 6;
  const doneFiles = files.filter((f) => f.status === "done");
  const uploading = files.some((f) => f.status === "uploading");

  async function uploadFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setFiles((prev) => [...prev, { name: file.name, key: "", status: "error" }]);
      return;
    }
    setFiles((prev) => [...prev, { name: file.name, key: "", status: "uploading" }]);
    try {
      const res = await fetch(`/api/upload-video-raw?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "content-type": file.type || "video/mp4" },
        body: file,
      });
      const data = (await res.json().catch(() => null)) as { ok: boolean; key?: string } | null;
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name && f.status === "uploading"
            ? data?.ok && data.key
              ? { ...f, key: data.key, status: "done" }
              : { ...f, status: "error" }
            : f,
        ),
      );
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name && f.status === "uploading" ? { ...f, status: "error" } : f,
        ),
      );
    }
  }

  async function sendIdeaToWit() {
    if (ideaText.trim().length < 5) return;
    setIdeaError(null);
    setIdeaStage("thinking");
    try {
      const res = await fetch("/api/wit-video-idea", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: ideaText.trim() }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok: boolean;
        title?: string;
        purpose?: string;
      } | null;
      if (!data?.ok || !data.title || !data.purpose) {
        setIdeaError("Wit no pudo estructurar tu idea — no te preocupes, ya la copiamos abajo.");
        setPurpose(ideaText.trim());
        setIdeaStage("manual");
        return;
      }
      setTitle(data.title);
      setPurpose(data.purpose);
      setIdeaStage("reviewing");
    } catch {
      setIdeaError("Wit no pudo estructurar tu idea — no te preocupes, ya la copiamos abajo.");
      setPurpose(ideaText.trim());
      setIdeaStage("manual");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (doneFiles.length === 0) {
      setError("Sube al menos un video antes de enviar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/video-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          purpose: purpose.trim(),
          platform,
          aspectRatio: PLATFORM_OPTIONS.find((p) => p.id === platform)?.aspect ?? "9:16",
          durationTarget: durationTarget.trim() || undefined,
          tone: tone.trim() || undefined,
          musicMood: musicMood.trim() || undefined,
          wantsAiScenes,
          aiScenesNote: wantsAiScenes ? aiScenesNote.trim() : undefined,
          rawFileKeys: doneFiles.map((f) => f.key),
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok: boolean } | null;
      if (!data?.ok) {
        setError("No pudimos enviar tu solicitud. Intenta de nuevo.");
        return;
      }
      onCreated();
    } catch {
      setError("No pudimos enviar tu solicitud. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 z-10 rounded-full p-2 text-wit-gray hover:bg-wit-mist/60 hover:text-wit-ink"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {step === 0 && (ideaStage === "composing" || ideaStage === "thinking") ? (
        <div className="mx-auto flex h-full max-w-lg flex-col px-5 py-8">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
              Paso 1 de {total}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-wit-ink">
              <VideoIcon className="h-6 w-6 text-wit-blue" strokeWidth={1.75} /> ¿Qué video quieres
              crear hoy?
            </h2>
          </div>

          <div className="flex-1 space-y-4">
            <ChatBubble
              role="assistant"
              text="Cuéntame la idea con tus palabras, como se te ocurra — puedes escribirla o hablarla con el micrófono. Yo le doy estructura."
            />
            {ideaStage === "thinking" ? <ChatBubble role="assistant" typingDots /> : null}
            <div className="relative">
              <textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                disabled={ideaStage === "thinking"}
                rows={5}
                placeholder="Ej. Quiero un video mostrando el antes y después de un tratamiento, tono cercano, para Instagram..."
                className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 pr-14 text-sm outline-none focus:border-wit-blue disabled:opacity-60"
              />
              <MicButton
                value={ideaText}
                onChange={setIdeaText}
                className="absolute bottom-3 right-3"
              />
            </div>
            {ideaError ? <p className="text-xs text-red-600">{ideaError}</p> : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-wit-gray hover:text-wit-ink"
            >
              ← Atrás
            </button>
            <button
              type="button"
              onClick={() => setIdeaStage("manual")}
              className="text-sm font-semibold text-wit-gray underline-offset-2 hover:text-wit-ink hover:underline"
            >
              Prefiero escribirlo yo
            </button>
            <button
              type="button"
              disabled={ideaText.trim().length < 5 || ideaStage === "thinking"}
              onClick={sendIdeaToWit}
              className="ml-auto rounded-full bg-wit-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-40"
            >
              {ideaStage === "thinking" ? "Wit está pensando..." : "Continuar"}
            </button>
          </div>
        </div>
      ) : step === 0 ? (
        <VStep
          qIndex={0}
          total={total}
          icon={VideoIcon}
          question={ideaStage === "reviewing" ? "Esto entendió Wit" : "¿Qué video quieres crear?"}
          subtitle={
            ideaStage === "reviewing"
              ? "Ajusta el título o el propósito si algo no cuadra."
              : "Un título corto y para qué lo vas a usar."
          }
          onBack={onClose}
          onNext={() => setStep(1)}
          nextDisabled={title.trim().length < 3 || purpose.trim().length < 10}
        >
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setIdeaStage("composing")}
              className="flex items-center gap-1.5 text-xs font-semibold text-wit-blue hover:underline"
            >
              <Pencil className="h-3 w-3" strokeWidth={2.5} />
              {ideaStage === "reviewing" ? "Volver a contarle la idea a Wit" : "Probar con Wit"}
            </button>
            {ideaStage === "reviewing" ? (
              <ChatBubble
                role="assistant"
                text="Así quedó estructurada tu idea — la puedes ajustar antes de continuar."
              />
            ) : null}
            {ideaError ? <p className="text-xs text-amber-600">{ideaError}</p> : null}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (ej. Promo de verano)"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="¿Qué quieres lograr con este video? ¿Qué debe transmitir?"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
          </div>
        </VStep>
      ) : step === 1 ? (
        <VStep
          qIndex={1}
          total={total}
          icon={Sparkles}
          question="¿Para qué plataforma es?"
          subtitle="Elige dónde se va a publicar — así ajustamos el formato."
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          nextDisabled={!platform}
        >
          <div className="grid grid-cols-3 gap-3">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition-colors ${
                  platform === p.id
                    ? "border-wit-blue bg-wit-blue/10"
                    : "border-wit-ink/12 bg-white hover:border-wit-ink/25"
                }`}
              >
                <p.icon
                  className={`h-6 w-6 ${platform === p.id ? "text-wit-blue" : "text-wit-ink"}`}
                  strokeWidth={1.75}
                />
                <span
                  className={`text-xs font-bold ${platform === p.id ? "text-wit-blue" : "text-wit-ink"}`}
                >
                  {p.label}
                </span>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={durationTarget}
            onChange={(e) => setDurationTarget(e.target.value)}
            placeholder="Duración deseada (opcional, ej. 15-30 seg)"
            className="mt-4 w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
          />
        </VStep>
      ) : step === 2 ? (
        <VStep
          qIndex={2}
          total={total}
          icon={Music2}
          question="Tono y música"
          subtitle="Opcional — ayúdanos a darle el ambiente correcto."
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        >
          <div className="space-y-4">
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Tono (ej. divertido, elegante, cercano)"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
            <input
              type="text"
              value={musicMood}
              onChange={(e) => setMusicMood(e.target.value)}
              placeholder="Referencia de música o ambiente (opcional)"
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
          </div>
        </VStep>
      ) : step === 3 ? (
        <VStep
          qIndex={3}
          total={total}
          icon={Sparkles}
          question="¿Quieres escenas generadas con IA?"
          subtitle="Podemos resolver tomas específicas con IA cuando no tengas ese metraje."
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextDisabled={wantsAiScenes && aiScenesNote.trim().length < 5}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2.5 rounded-xl border border-wit-ink/15 px-4 py-3 text-sm font-semibold text-wit-ink">
              <input
                type="checkbox"
                checked={wantsAiScenes}
                onChange={(e) => setWantsAiScenes(e.target.checked)}
                className="h-4 w-4 rounded border-wit-ink/30"
              />
              Sí, quiero algunas escenas resueltas con IA
            </label>
            {wantsAiScenes ? (
              <textarea
                value={aiScenesNote}
                onChange={(e) => setAiScenesNote(e.target.value)}
                rows={4}
                placeholder="Describe qué escenas o momentos quieres resueltos con IA"
                className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
              />
            ) : null}
          </div>
        </VStep>
      ) : step === 4 ? (
        <VStep
          qIndex={4}
          total={total}
          icon={Upload}
          question="Sube tu metraje"
          subtitle="Puedes subir varios clips. Formatos MP4, MOV o WebM."
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
          nextDisabled={doneFiles.length === 0 || uploading}
          nextLabel={uploading ? "Subiendo..." : "Siguiente"}
        >
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-wit-ink/25 px-4 py-8 text-center hover:border-wit-blue">
              <Upload className="h-6 w-6 text-wit-blue" strokeWidth={1.75} />
              <span className="text-sm font-semibold text-wit-ink">Elegir video(s)</span>
              <span className="text-xs text-wit-gray">Máximo 500 MB por archivo.</span>
              <input
                type="file"
                accept={VIDEO_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  list.forEach((f) => void uploadFile(f));
                }}
              />
            </label>
            {files.length > 0 ? (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-wit-mist/40 px-3.5 py-2.5 text-xs"
                  >
                    <span className="truncate font-semibold text-wit-ink">{f.name}</span>
                    {f.status === "uploading" ? (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin text-wit-blue"
                        strokeWidth={2.5}
                      />
                    ) : f.status === "done" ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-emerald-600"
                        strokeWidth={2.25}
                      />
                    ) : (
                      <span className="shrink-0 font-bold text-red-600">Error</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </VStep>
      ) : (
        <VStep
          qIndex={5}
          total={total}
          icon={CheckCircle2}
          question="Revisa y envía"
          onBack={() => setStep(4)}
          onNext={handleSubmit}
          nextLabel={submitting ? "Enviando..." : "Enviar solicitud"}
          nextDisabled={submitting}
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-wit-mist/40 px-4 py-3">
              <p className="font-bold text-wit-ink">{title}</p>
              <p className="mt-1 text-wit-gray">{purpose}</p>
            </div>
            <p className="text-wit-gray">
              Plataforma:{" "}
              <span className="font-semibold text-wit-ink">
                {PLATFORM_OPTIONS.find((p) => p.id === platform)?.label}
              </span>
              {durationTarget ? ` · ${durationTarget}` : ""}
            </p>
            {tone || musicMood ? (
              <p className="text-wit-gray">
                {tone ? `Tono: ${tone}` : ""}
                {tone && musicMood ? " · " : ""}
                {musicMood ? `Música: ${musicMood}` : ""}
              </p>
            ) : null}
            {wantsAiScenes ? (
              <p className="text-wit-gray">
                Escenas con IA: <span className="font-semibold text-wit-ink">{aiScenesNote}</span>
              </p>
            ) : null}
            <p className="text-wit-gray">
              {doneFiles.length} archivo{doneFiles.length === 1 ? "" : "s"} de video listo
              {doneFiles.length === 1 ? "" : "s"} para enviar.
            </p>
            {error ? <p className="text-red-600">{error}</p> : null}
          </div>
        </VStep>
      )}
    </div>
  );
}
