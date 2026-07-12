import { useEffect, useRef, useState } from "react";

// Shared between the admin AI-lab chat (admin-lab.tsx) and the public
// homepage teaser (routes/index.tsx) — these four are the "quick tap,
// no typing, no auth needed" pickers, so they're the ones worth reusing
// outside the admin-only lab. Kept here instead of duplicated so the two
// surfaces can't silently drift apart.

export const ASPECT_OPTIONS: { value: string; label: string }[] = [
  { value: "1:1", label: "Cuadrado" },
  { value: "4:3", label: "Feed" },
  { value: "16:9", label: "Horizontal" },
  { value: "3:4", label: "Vertical" },
  { value: "9:16", label: "Historia" },
];

export const PIECE_TYPE_OPTIONS = ["Instagram", "Historia", "Facebook", "Banner web", "Impreso", "Otro"];

// No real photography to preview each style with, so each swatch is a small
// CSS treatment that evokes the vibe instead: minimalista plain, elegante
// dark, colorido a vivid gradient, corporativo structured blues, bold loud.
export const STYLE_OPTIONS: { value: string; swatchClass: string }[] = [
  { value: "Minimalista", swatchClass: "border border-wit-ink/15 bg-white" },
  { value: "Premium / Elegante", swatchClass: "bg-gradient-to-br from-wit-ink to-black" },
  { value: "Colorido", swatchClass: "bg-gradient-to-br from-pink-400 via-amber-300 to-sky-400" },
  { value: "Corporativo", swatchClass: "bg-gradient-to-br from-wit-blue to-wit-navy" },
  { value: "Divertido / Bold", swatchClass: "bg-gradient-to-br from-orange-400 to-fuchsia-500" },
];

// Plain pill chips, one tap = submit — there's no natural "shape" for a
// platform the way there is for an aspect ratio, so no preview needed here.
export function PieceTypePicker({ onPick }: { onPick: (value: string) => void }) {
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
export function StylePicker({ onPick }: { onPick: (value: string) => void }) {
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

// Each ratio is its own small floating badge (same wit-float bob the WMark
// logo uses elsewhere) with just the number inside — the label sits below
// it, static, not bundled into one shared card the way the badges are.
// Laid out in one horizontal, scrollable line so nothing ever wraps into a
// grid.
export function AspectRatioPicker({ onPick }: { onPick: (value: string) => void }) {
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
export function ColorsPicker({ onPick }: { onPick: (value: string) => void }) {
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

// Curated, not exhaustive — covers the industries a design membership
// service actually sees, with "Otro" (typed free text) as the escape
// valve for the long tail instead of trying to enumerate every business.
export const BUSINESS_INDUSTRIES: { value: string; types: string[] }[] = [
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

export const AUDIENCE_OPTIONS = ["Mujeres", "Hombres", "Todos", "Empresas"];

// Same five ranges the real form (panel.tsx) uses, so the two stay in sync.
export const AGE_CHIPS = ["18-24", "25-34", "35-44", "45-54", "55+"];

// Hand-drawn, one glyph per option instead of one icon family reused with a
// className swap — each option reads clearer through its own convention
// (gender symbols, a group of dots, a building) than it would forcing
// every concept through the same shape language.
function AudienceIcon({ value }: { value: string }) {
  const stroke = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (value) {
    case "Mujeres":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <circle cx="12" cy="8" r="5" />
          <line x1="12" y1="13" x2="12" y2="21" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      );
    case "Hombres":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <circle cx="9" cy="15" r="5" />
          <line x1="12.5" y1="11.5" x2="19" y2="5" />
          <polyline points="13,5 19,5 19,11" />
        </svg>
      );
    case "Todos":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24">
          <circle cx="7" cy="9" r="3" fill="currentColor" />
          <circle cx="17" cy="9" r="3" fill="currentColor" />
          <circle cx="12" cy="16" r="3.5" fill="currentColor" />
        </svg>
      );
    case "Empresas":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <rect x="6" y="4" width="12" height="17" />
          <rect x="9" y="7" width="2" height="2" fill="currentColor" stroke="none" />
          <rect x="13" y="7" width="2" height="2" fill="currentColor" stroke="none" />
          <rect x="9" y="11" width="2" height="2" fill="currentColor" stroke="none" />
          <rect x="13" y="11" width="2" height="2" fill="currentColor" stroke="none" />
          <rect x="9" y="15" width="2" height="2" fill="currentColor" stroke="none" />
          <rect x="13" y="15" width="2" height="2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

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
    navigator.vibrate(10);
  }
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!wheelAudioCtx) wheelAudioCtx = new Ctx();
    if (wheelAudioCtx.state === "suspended") void wheelAudioCtx.resume();
    const ctx = wheelAudioCtx;
    // A short burst of high-passed white noise with a built-in linear
    // decay, not an oscillator tone — a tone always has pitch/ring to it,
    // which read as a dated "beep" rather than a dry mechanical click.
    const duration = 0.018;
    const sampleCount = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 3500;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    // sound is a nice-to-have — never let it throw into the scroll handler
  }
}

export function AudiencePicker({ onPick }: { onPick: (value: string) => void }) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");

  if (customMode) {
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
          aria-label="Tu público objetivo"
          value={customText}
          onChange={(ev) => setCustomText(ev.target.value)}
          placeholder="Escribe a quién le hablas..."
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

  return (
    <div className="flex flex-col items-center gap-3 px-1 py-2">
      <div className="flex items-start justify-center gap-4">
        {AUDIENCE_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            className="flex flex-col items-center gap-1 transition-transform hover:scale-[1.05] active:scale-95"
          >
            <span className="wit-float text-wit-blue">
              <AudienceIcon value={opt} />
            </span>
            <span className="text-center text-[10px] font-semibold leading-tight text-wit-gray">{opt}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setCustomMode(true)}
        className="text-[10px] font-semibold text-wit-gray transition-transform hover:scale-[1.05] hover:text-wit-ink active:scale-95"
      >
        Otro
      </button>
    </div>
  );
}

// Toggle any number of chips, then confirm — unlike a single-select picker,
// tapping a chip here can't submit right away since the client might still
// want to add or remove another range.
export function AgeRangeMultiPicker({ onPick }: { onPick: (value: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(chip: string) {
    setSelected((prev) => (prev.includes(chip) ? prev.filter((x) => x !== chip) : [...prev, chip]));
  }

  return (
    <div className="wit-glass mx-auto flex max-w-[280px] flex-col items-center gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="flex flex-wrap justify-center gap-2">
        {AGE_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => toggle(chip)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              selected.includes(chip) ? "bg-wit-blue text-white" : "bg-wit-mist/50 text-wit-ink hover:bg-wit-mist"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPick(selected.join(", "))}
        className="rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
      >
        Continuar
      </button>
    </div>
  );
}

// Shared by both upload pickers below — same endpoint and constraints the
// real client form (panel.tsx) already uses, so a key captured here is
// valid anywhere in the app that reads request_results/design_requests
// file keys.
export async function uploadReferenceFile(file: File): Promise<string | undefined> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload-reference", { method: "POST", body: fd });
  const data = (await res.json().catch(() => null)) as { ok: boolean; key?: string } | null;
  return data?.ok ? data.key : undefined;
}

// Required, but "No tengo logotipo" is a legitimate answer — matches the
// real form's same escape hatch (it doesn't have the "usar el logotipo de
// mi solicitud anterior" option here, since this lab has no client request
// history to reuse from).
export function LogoUploadPicker({ onPick }: { onPick: (value: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [noLogo, setNoLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (noLogo) {
      onPick("Sin logotipo");
      return;
    }
    if (!file) {
      setError("Sube tu logotipo o marca 'No tengo logotipo'.");
      return;
    }
    setError(null);
    setUploading(true);
    const key = await uploadReferenceFile(file);
    setUploading(false);
    if (!key) {
      setError("No pudimos subir tu logotipo (PNG, JPG o WebP, máx. 8 MB).");
      return;
    }
    onPick(key);
  }

  return (
    <div className="wit-glass mx-auto flex max-w-[280px] flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <input
        type="file"
        aria-label="Tu logotipo"
        accept="image/png,image/jpeg,image/webp"
        disabled={noLogo}
        onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
        className="w-full rounded-xl border border-dashed border-wit-ink/20 px-3 py-2.5 text-xs text-wit-gray file:mr-2 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-wit-blue disabled:opacity-40"
      />
      <label className="flex items-center gap-2 text-xs text-wit-ink">
        <input
          type="checkbox"
          checked={noLogo}
          onChange={(ev) => setNoLogo(ev.target.checked)}
          className="h-4 w-4 rounded border-wit-ink/30"
        />
        No tengo logotipo
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleContinue}
        disabled={uploading}
        className="self-center rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
      >
        {uploading ? "Subiendo..." : "Continuar"}
      </button>
    </div>
  );
}

// Optional — the generic Omitir link above the question bubble already
// handles "skip entirely," so this only needs to handle the upload path.
export function ProductPhotoUploadPicker({ onPick }: { onPick: (value: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    const key = await uploadReferenceFile(file);
    setUploading(false);
    if (!key) {
      setError("No pudimos subir la foto (PNG, JPG o WebP, máx. 8 MB).");
      return;
    }
    onPick(key);
  }

  return (
    <div className="wit-glass mx-auto flex max-w-[280px] flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <input
        type="file"
        aria-label="Foto del producto"
        accept="image/png,image/jpeg,image/webp"
        onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
        className="w-full rounded-xl border border-dashed border-wit-ink/20 px-3 py-2.5 text-xs text-wit-gray file:mr-2 file:rounded-lg file:border-0 file:bg-wit-mist/60 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-wit-blue"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading}
        className="self-center rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
      >
        {uploading ? "Subiendo..." : "Subir"}
      </button>
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
export function BusinessTypeWheel({ onPick }: { onPick: (value: string) => void }) {
  // One wheel visible at a time — industry first, and only once that's
  // locked in with "Siguiente" does the business-type wheel for it appear,
  // instead of both spinning on screen together.
  const [step, setStep] = useState<"industry" | "type">("industry");
  const [industry, setIndustry] = useState(BUSINESS_INDUSTRIES[0].value);
  const [type, setType] = useState(BUSINESS_INDUSTRIES[0].types[0]);
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

  if (step === "industry") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <WheelPicker items={BUSINESS_INDUSTRIES.map((i) => i.value)} onSettle={setIndustry} />
          <button
            type="button"
            onClick={() => setCustomStep("industry")}
            className="shrink-0 rounded-full bg-wit-mist/50 px-3 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            Otro
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const entry = BUSINESS_INDUSTRIES.find((i) => i.value === industry);
            setType(entry?.types[0] ?? "");
            setStep("type");
          }}
          className="rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          Siguiente
        </button>
      </div>
    );
  }

  const industryEntry = BUSINESS_INDUSTRIES.find((i) => i.value === industry);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <WheelPicker items={industryEntry?.types ?? []} onSettle={setType} />
        <button
          type="button"
          onClick={() => setCustomStep("type")}
          className="shrink-0 rounded-full bg-wit-mist/50 px-3 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          Otro
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep("industry")}
          className="text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={() => onPick(type)}
          className="rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}
