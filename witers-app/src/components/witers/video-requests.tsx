// Client-facing "solicitudes de video" — the video counterpart of
// panel.tsx's image-request flow (Grow/Scale already sell "2/4 videos" in
// membership-plans.ts, this is what actually fulfills it). Lives inside
// Creatividad as a sibling of the image flow (same "hacer solicitud / mis
// solicitudes" shape) rather than its own top-level section — panel.tsx
// owns the query, the tab state, and the wizard portal, exactly like it
// does for images; this file just exports the pieces it composes.
import { useState } from "react";
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
import { useLanguage } from "../../lib/i18n";

export type VideoRequestRow = {
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

const STATUS_LABEL: Record<string, { es: string; en: string; cls: string }> = {
  nueva: { es: "En cola", en: "Queued", cls: "bg-amber-50 text-amber-700" },
  en_proceso: { es: "En edición", en: "Editing", cls: "bg-amber-50 text-amber-700" },
  completada: { es: "Listo", en: "Ready", cls: "bg-emerald-50 text-emerald-700" },
  rechazada: { es: "Rechazada", en: "Rejected", cls: "bg-red-50 text-red-600" },
};

const PLATFORM_OPTIONS: {
  id: string;
  label: string;
  en: string;
  aspect: string;
  icon: LucideIcon;
}[] = [
  { id: "instagram", label: "Instagram", en: "Instagram", aspect: "9:16", icon: Instagram },
  { id: "tiktok", label: "TikTok", en: "TikTok", aspect: "9:16", icon: Music2 },
  { id: "youtube", label: "YouTube", en: "YouTube", aspect: "16:9", icon: Youtube },
  { id: "facebook", label: "Facebook", en: "Facebook", aspect: "1:1", icon: Facebook },
  { id: "otro", label: "Otro", en: "Other", aspect: "9:16", icon: Clapperboard },
];

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

// Same landing pattern as panel.tsx's HablaConWitScreen (images) — a big
// centered call to action, not a form. Shows an upgrade nudge instead of
// the CTA when the plan doesn't include video at all, and a "used up for
// this month" message instead when the quota's just exhausted.
export function VideoLandingScreen({
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
  const { t } = useLanguage();
  const remaining = quotaTotal - quotaUsed;
  const blocked = !active || remaining <= 0;

  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-3xl bg-wit-ice py-20 text-center">
      <div className="wit-float">
        <VideoIcon className="h-11 w-11 text-wit-blue" strokeWidth={1.5} />
      </div>
      <p className="max-w-xs text-base text-wit-gray">
        {quotaTotal === 0
          ? t(
              "Los planes Grow y Scale incluyen videos para redes sociales.",
              "The Grow and Scale plans include videos for social media.",
            )
          : remaining <= 0
            ? t(
                "Ya usaste tus videos disponibles este mes. Vuelven a estar disponibles en tu próximo ciclo.",
                "You've used up your available videos this month. They'll be available again next cycle.",
              )
            : t(
                "Cuéntanos qué video quieres crear y sube tu metraje — nosotros lo editamos.",
                "Tell us what video you want to create and upload your footage — we'll edit it.",
              )}
      </p>
      {quotaTotal === 0 ? (
        <a
          href="/upgrade"
          className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
        >
          {t("Ver planes", "View plans")}
        </a>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={blocked}
          className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("🎬 Nueva solicitud de video", "🎬 New video request")}
        </button>
      )}
      {quotaTotal > 0 ? (
        <p className="text-xs font-semibold text-wit-gray">
          {t(
            `${quotaUsed} de ${quotaTotal} videos usados este mes.`,
            `${quotaUsed} of ${quotaTotal} videos used this month.`,
          )}
        </p>
      ) : null}
    </div>
  );
}

export function VideoRequestList({ rows, loading }: { rows: VideoRequestRow[]; loading: boolean }) {
  const { t } = useLanguage();
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
          <p className="text-base font-semibold text-wit-ink">
            {t("Aún no tienes solicitudes de video.", "You don't have any video requests yet.")}
          </p>
          <p className="mt-1 text-sm text-wit-gray">
            {t(
              "Sube tu metraje y cuéntanos qué necesitas — nosotros lo editamos.",
              "Upload your footage and tell us what you need — we'll edit it.",
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <VideoEntry key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoEntry({ row }: { row: VideoRequestRow }) {
  const { t } = useLanguage();
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
            {row.aspect_ratio} ·{" "}
            {t(
              `${rawFiles.length} archivo${rawFiles.length === 1 ? "" : "s"} subido${rawFiles.length === 1 ? "" : "s"}`,
              `${rawFiles.length} file${rawFiles.length === 1 ? "" : "s"} uploaded`,
            )}{" "}
            ·{" "}
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
          {t(st.es, st.en)}
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
            {t("Descargar video", "Download video")}
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
  nextLabel,
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
  const { t } = useLanguage();
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col px-5 py-8">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
          {t(`Paso ${qIndex + 1} de ${total}`, `Step ${qIndex + 1} of ${total}`)}
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
            {t("← Atrás", "← Back")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="ml-auto rounded-full bg-wit-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-40"
        >
          {nextLabel ?? t("Siguiente", "Next")}
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

export function VideoWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
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
        setIdeaError(
          t(
            "Wit no pudo estructurar tu idea — no te preocupes, ya la copiamos abajo.",
            "Wit couldn't structure your idea — don't worry, we already copied it below.",
          ),
        );
        setPurpose(ideaText.trim());
        setIdeaStage("manual");
        return;
      }
      setTitle(data.title);
      setPurpose(data.purpose);
      setIdeaStage("reviewing");
    } catch {
      setIdeaError(
        t(
          "Wit no pudo estructurar tu idea — no te preocupes, ya la copiamos abajo.",
          "Wit couldn't structure your idea — don't worry, we already copied it below.",
        ),
      );
      setPurpose(ideaText.trim());
      setIdeaStage("manual");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (doneFiles.length === 0) {
      setError(
        t(
          "Sube al menos un video antes de enviar.",
          "Upload at least one video before submitting.",
        ),
      );
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
        setError(
          t(
            "No pudimos enviar tu solicitud. Intenta de nuevo.",
            "We couldn't send your request. Try again.",
          ),
        );
        return;
      }
      onCreated();
    } catch {
      setError(
        t(
          "No pudimos enviar tu solicitud. Intenta de nuevo.",
          "We couldn't send your request. Try again.",
        ),
      );
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
        aria-label={t("Cerrar", "Close")}
      >
        <X className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {step === 0 && (ideaStage === "composing" || ideaStage === "thinking") ? (
        <div className="mx-auto flex h-full max-w-lg flex-col px-5 py-8">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-wit-gray">
              {t(`Paso 1 de ${total}`, `Step 1 of ${total}`)}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-wit-ink">
              <VideoIcon className="h-6 w-6 text-wit-blue" strokeWidth={1.75} />{" "}
              {t("¿Qué video quieres crear hoy?", "What video do you want to create today?")}
            </h2>
          </div>

          <div className="flex-1 space-y-4">
            <ChatBubble
              role="assistant"
              text={t(
                "Cuéntame la idea con tus palabras, como se te ocurra — puedes escribirla o hablarla con el micrófono. Yo le doy estructura.",
                "Tell me your idea in your own words, however it comes to you — you can type it or dictate it with the microphone. I'll give it structure.",
              )}
            />
            {ideaStage === "thinking" ? <ChatBubble role="assistant" typingDots /> : null}
            <div className="relative">
              <textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                disabled={ideaStage === "thinking"}
                rows={5}
                placeholder={t(
                  "Ej. Quiero un video mostrando el antes y después de un tratamiento, tono cercano, para Instagram...",
                  "E.g. I want a video showing the before and after of a treatment, warm tone, for Instagram...",
                )}
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
              {t("← Atrás", "← Back")}
            </button>
            <button
              type="button"
              onClick={() => setIdeaStage("manual")}
              className="text-sm font-semibold text-wit-gray underline-offset-2 hover:text-wit-ink hover:underline"
            >
              {t("Prefiero escribirlo yo", "I'd rather write it myself")}
            </button>
            <button
              type="button"
              disabled={ideaText.trim().length < 5 || ideaStage === "thinking"}
              onClick={sendIdeaToWit}
              className="ml-auto rounded-full bg-wit-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-wit-blue-deep disabled:opacity-40"
            >
              {ideaStage === "thinking"
                ? t("Wit está pensando...", "Wit is thinking...")
                : t("Continuar", "Continue")}
            </button>
          </div>
        </div>
      ) : step === 0 ? (
        <VStep
          qIndex={0}
          total={total}
          icon={VideoIcon}
          question={
            ideaStage === "reviewing"
              ? t("Esto entendió Wit", "Here's what Wit understood")
              : t("¿Qué video quieres crear?", "What video do you want to create?")
          }
          subtitle={
            ideaStage === "reviewing"
              ? t(
                  "Ajusta el título o el propósito si algo no cuadra.",
                  "Adjust the title or the purpose if something's off.",
                )
              : t(
                  "Un título corto y para qué lo vas a usar.",
                  "A short title and what you're going to use it for.",
                )
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
              {ideaStage === "reviewing"
                ? t("Volver a contarle la idea a Wit", "Tell Wit the idea again")
                : t("Probar con Wit", "Try with Wit")}
            </button>
            {ideaStage === "reviewing" ? (
              <ChatBubble
                role="assistant"
                text={t(
                  "Así quedó estructurada tu idea — la puedes ajustar antes de continuar.",
                  "Here's your idea structured — you can adjust it before continuing.",
                )}
              />
            ) : null}
            {ideaError ? <p className="text-xs text-amber-600">{ideaError}</p> : null}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("Título (ej. Promo de verano)", "Title (e.g. Summer promo)")}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder={t(
                "¿Qué quieres lograr con este video? ¿Qué debe transmitir?",
                "What do you want to achieve with this video? What should it convey?",
              )}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
          </div>
        </VStep>
      ) : step === 1 ? (
        <VStep
          qIndex={1}
          total={total}
          icon={Sparkles}
          question={t("¿Para qué plataforma es?", "Which platform is it for?")}
          subtitle={t(
            "Elige dónde se va a publicar — así ajustamos el formato.",
            "Choose where it'll be published — that way we adjust the format.",
          )}
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
                  {t(p.label, p.en)}
                </span>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={durationTarget}
            onChange={(e) => setDurationTarget(e.target.value)}
            placeholder={t(
              "Duración deseada (opcional, ej. 15-30 seg)",
              "Desired duration (optional, e.g. 15-30 sec)",
            )}
            className="mt-4 w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
          />
        </VStep>
      ) : step === 2 ? (
        <VStep
          qIndex={2}
          total={total}
          icon={Music2}
          question={t("Tono y música", "Tone and music")}
          subtitle={t(
            "Opcional — ayúdanos a darle el ambiente correcto.",
            "Optional — help us give it the right mood.",
          )}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        >
          <div className="space-y-4">
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder={t(
                "Tono (ej. divertido, elegante, cercano)",
                "Tone (e.g. fun, elegant, warm)",
              )}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
            <input
              type="text"
              value={musicMood}
              onChange={(e) => setMusicMood(e.target.value)}
              placeholder={t(
                "Referencia de música o ambiente (opcional)",
                "Music or mood reference (optional)",
              )}
              className="w-full rounded-xl border border-wit-ink/15 px-4 py-3 text-sm outline-none focus:border-wit-blue"
            />
          </div>
        </VStep>
      ) : step === 3 ? (
        <VStep
          qIndex={3}
          total={total}
          icon={Sparkles}
          question={t("¿Quieres escenas generadas con IA?", "Do you want AI-generated scenes?")}
          subtitle={t(
            "Podemos resolver tomas específicas con IA cuando no tengas ese metraje.",
            "We can handle specific shots with AI when you don't have that footage.",
          )}
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
              {t(
                "Sí, quiero algunas escenas resueltas con IA",
                "Yes, I want some scenes done with AI",
              )}
            </label>
            {wantsAiScenes ? (
              <textarea
                value={aiScenesNote}
                onChange={(e) => setAiScenesNote(e.target.value)}
                rows={4}
                placeholder={t(
                  "Describe qué escenas o momentos quieres resueltos con IA",
                  "Describe which scenes or moments you want done with AI",
                )}
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
          question={t("Sube tu metraje", "Upload your footage")}
          subtitle={t(
            "Puedes subir varios clips. Formatos MP4, MOV o WebM.",
            "You can upload several clips. MP4, MOV, or WebM formats.",
          )}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
          nextDisabled={doneFiles.length === 0 || uploading}
          nextLabel={uploading ? t("Subiendo...", "Uploading...") : t("Siguiente", "Next")}
        >
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-wit-ink/25 px-4 py-8 text-center hover:border-wit-blue">
              <Upload className="h-6 w-6 text-wit-blue" strokeWidth={1.75} />
              <span className="text-sm font-semibold text-wit-ink">
                {t("Elegir video(s)", "Choose video(s)")}
              </span>
              <span className="text-xs text-wit-gray">
                {t("Máximo 500 MB por archivo.", "Maximum 500 MB per file.")}
              </span>
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
                      <span className="shrink-0 font-bold text-red-600">{t("Error", "Error")}</span>
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
          question={t("Revisa y envía", "Review and submit")}
          onBack={() => setStep(4)}
          onNext={handleSubmit}
          nextLabel={
            submitting ? t("Enviando...", "Sending...") : t("Enviar solicitud", "Submit request")
          }
          nextDisabled={submitting}
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-wit-mist/40 px-4 py-3">
              <p className="font-bold text-wit-ink">{title}</p>
              <p className="mt-1 text-wit-gray">{purpose}</p>
            </div>
            <p className="text-wit-gray">
              {t("Plataforma:", "Platform:")}{" "}
              <span className="font-semibold text-wit-ink">
                {(() => {
                  const p = PLATFORM_OPTIONS.find((p) => p.id === platform);
                  return p ? t(p.label, p.en) : undefined;
                })()}
              </span>
              {durationTarget ? ` · ${durationTarget}` : ""}
            </p>
            {tone || musicMood ? (
              <p className="text-wit-gray">
                {tone ? `${t("Tono", "Tone")}: ${tone}` : ""}
                {tone && musicMood ? " · " : ""}
                {musicMood ? `${t("Música", "Music")}: ${musicMood}` : ""}
              </p>
            ) : null}
            {wantsAiScenes ? (
              <p className="text-wit-gray">
                {t("Escenas con IA:", "AI scenes:")}{" "}
                <span className="font-semibold text-wit-ink">{aiScenesNote}</span>
              </p>
            ) : null}
            <p className="text-wit-gray">
              {t(
                `${doneFiles.length} archivo${doneFiles.length === 1 ? "" : "s"} de video listo${doneFiles.length === 1 ? "" : "s"} para enviar.`,
                `${doneFiles.length} video file${doneFiles.length === 1 ? "" : "s"} ready to send.`,
              )}
            </p>
            {error ? <p className="text-red-600">{error}</p> : null}
          </div>
        </VStep>
      )}
    </div>
  );
}
