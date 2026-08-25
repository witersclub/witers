import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

import { useLanguage } from "../../lib/i18n";
import { GoogleFontPicker } from "./google-font-picker";

// A small "(i)" button that reveals a short explanation on tap — built for
// ColorsPicker's onboarding-only `showInfo` mode (a client asked for help
// right at the moment someone unfamiliar with the chat has to pick brand
// colors), kept generic enough to reuse anywhere else a step could use a
// one-line hint without permanently cluttering the screen with it.
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Info"
        aria-expanded={open}
        className="flex h-4 w-4 items-center justify-center rounded-full text-wit-gray hover:text-wit-blue"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open ? (
        <div className="wit-rise absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-xl bg-wit-ink px-3 py-2 text-left text-[11px] font-normal leading-snug text-white shadow-[0_10px_30px_rgba(5,13,40,0.25)]">
          {text}
          <span
            aria-hidden="true"
            className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-wit-ink"
          />
        </div>
      ) : null}
    </div>
  );
}

// Shared between the admin AI-lab chat (admin-lab.tsx) and the public
// homepage teaser (routes/index.tsx) — these four are the "quick tap,
// no typing, no auth needed" pickers, so they're the ones worth reusing
// outside the admin-only lab. Kept here instead of duplicated so the two
// surfaces can't silently drift apart.

export const ASPECT_OPTIONS: { value: string; label: string; en: string }[] = [
  { value: "1:1", label: "Cuadrado", en: "Square" },
  { value: "4:3", label: "Clásico", en: "Classic" },
  { value: "16:9", label: "Horizontal", en: "Landscape" },
  { value: "3:4", label: "Feed", en: "Feed" },
  { value: "9:16", label: "Historia", en: "Story" },
];

export const PIECE_TYPE_OPTIONS: { value: string; en: string }[] = [
  { value: "Instagram", en: "Instagram" },
  { value: "Historia", en: "Story" },
  { value: "Facebook", en: "Facebook" },
  { value: "Banner web", en: "Web banner" },
  { value: "Impreso", en: "Print" },
  { value: "Otro", en: "Other" },
];

// No real photography to preview each style with, so each swatch is a small
// CSS treatment that evokes the vibe instead: minimalista plain, elegante
// dark, colorido a vivid gradient, corporativo structured blues, bold loud.
export const STYLE_OPTIONS: { value: string; en: string; swatchClass: string }[] = [
  { value: "Minimalista", en: "Minimalist", swatchClass: "border border-wit-ink/15 bg-white" },
  {
    value: "Premium / Elegante",
    en: "Premium / Elegant",
    swatchClass: "bg-gradient-to-br from-wit-ink to-black",
  },
  {
    value: "Colorido",
    en: "Colorful",
    swatchClass: "bg-gradient-to-br from-pink-400 via-amber-300 to-sky-400",
  },
  {
    value: "Corporativo",
    en: "Corporate",
    swatchClass: "bg-gradient-to-br from-wit-blue to-wit-navy",
  },
  {
    value: "Divertido / Bold",
    en: "Fun / Bold",
    swatchClass: "bg-gradient-to-br from-orange-400 to-fuchsia-500",
  },
];

// Plain pill chips, one tap = submit — there's no natural "shape" for a
// platform the way there is for an aspect ratio, so no preview needed here.
export function PieceTypePicker({ onPick }: { onPick: (value: string) => void }) {
  const { t } = useLanguage();
  return (
    <div className="wit-glass flex flex-wrap justify-center gap-2 rounded-2xl p-3 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      {PIECE_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-transform hover:scale-[1.03] active:scale-95 ${
            opt.value === "Otro"
              ? "bg-wit-blue text-white hover:bg-wit-blue-deep"
              : "bg-wit-mist/50 text-wit-ink hover:bg-wit-mist"
          }`}
        >
          {t(opt.value, opt.en)}
        </button>
      ))}
    </div>
  );
}

// Tap a swatch, done — no popup, no confirm step, just pick the vibe that
// looks right.
export function StylePicker({ onPick }: { onPick: (value: string) => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap justify-center gap-3 px-1 py-2">
      {STYLE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className="flex flex-col items-center gap-1.5 transition-transform hover:scale-[1.05] active:scale-95"
        >
          <span
            className={`h-12 w-12 rounded-xl shadow-[0_8px_20px_rgba(5,13,40,0.15)] ${opt.swatchClass}`}
          />
          <span className="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight text-wit-gray">
            {t(opt.value, opt.en)}
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
export function AspectRatioPicker({
  onPick,
  options = ASPECT_OPTIONS,
}: {
  onPick: (value: string) => void;
  // Defaults to every ratio — pass a filtered subset for a format that
  // doesn't support the full set (e.g. video, which has no 4:3/3:4).
  options?: typeof ASPECT_OPTIONS;
}) {
  const { t } = useLanguage();
  return (
    // overflow-y-visible undoes the overflow-y:auto that overflow-x-auto
    // implies on its own — without it, the tallest badge's float bob got
    // clipped by this row's own box on every upswing.
    <div className="flex items-end justify-center gap-4 overflow-x-auto overflow-y-visible px-1 pb-2 pt-4">
      {options.map((opt) => (
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
          <span className="text-[10px] font-semibold text-wit-gray">{t(opt.label, opt.en)}</span>
        </button>
      ))}
    </div>
  );
}

// Two steps (how many, then which) instead of one screen with three color
// wells always visible — a client with one brand color shouldn't have to
// stare at two empty pickers wondering what to do with them.
export function ColorsPicker({
  onPick,
  showInfo = false,
}: {
  onPick: (value: string) => void;
  // Only turned on for the mandatory brand-onboarding chat (see
  // panel.tsx's OnboardingGate) — the admin lab and homepage teaser using
  // this same picker don't need it, so it defaults off rather than
  // showing up everywhere ColorsPicker is reused.
  showInfo?: boolean;
}) {
  const { t } = useLanguage();
  const [count, setCount] = useState<number | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  if (count === null) {
    return (
      <div className="wit-glass flex flex-col items-center gap-2.5 rounded-2xl px-4 py-3.5 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-wit-gray">
            {t("¿Cuántos colores de marca usas?", "How many brand colors do you use?")}
          </p>
          {showInfo ? (
            <InfoTooltip
              text={t(
                "La mayoría de las marcas usan de 1 a 3 colores: uno principal y, si tienes, uno o dos de apoyo. Si no estás seguro, elige 1 — siempre puedes ajustarlo después.",
                "Most brands use 1 to 3 colors: one main color and, if you have them, one or two supporting ones. If you're not sure, pick 1 — you can always adjust it later.",
              )}
            />
          ) : null}
        </div>
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
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium text-wit-gray">
          {t(
            "👆 Toca cada círculo para elegir tu color — vienen en azul solo de ejemplo.",
            "👆 Tap each circle to pick your color — they start blue just as an example.",
          )}
        </p>
        {showInfo ? (
          <InfoTooltip
            text={t(
              "Al tocar un círculo se abre el selector de color de tu navegador o teléfono. El código (por ejemplo #0047FF) aparece debajo — si ya lo conoces, puedes escribirlo ahí directamente. El primer círculo suele ser el color principal de tu marca.",
              "Tapping a circle opens your browser or phone's color picker. The code (like #0047FF) shows underneath — if you already know it, you can type it in directly. The first circle is usually your brand's main color.",
            )}
          />
        ) : null}
      </div>
      <div className="flex gap-3">
        {colors.map((c, i) => (
          <label key={i} className="flex flex-col items-center gap-1">
            <input
              type="color"
              aria-label={`${t("Color", "Color")} ${i + 1}`}
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
          {t("Atrás", "Back")}
        </button>
        <button
          type="button"
          onClick={() => onPick(colors.map((c) => c.toUpperCase()).join(", "))}
          className="rounded-full bg-wit-blue px-5 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Listo", "Done")}
        </button>
      </div>
    </div>
  );
}

// Curated, not exhaustive — covers the industries a design membership
// service actually sees, with "Otro" (typed free text) as the escape
// valve for the long tail instead of trying to enumerate every business.
export const BUSINESS_INDUSTRIES: {
  value: string;
  en: string;
  types: { value: string; en: string }[];
}[] = [
  {
    value: "Alimentos y bebidas",
    en: "Food and beverage",
    types: [
      { value: "Restaurante", en: "Restaurant" },
      { value: "Cafetería", en: "Café" },
      { value: "Panadería / Repostería", en: "Bakery / Pastry shop" },
      { value: "Bar", en: "Bar" },
      { value: "Catering", en: "Catering" },
    ],
  },
  {
    value: "Salud y bienestar",
    en: "Health and wellness",
    types: [
      { value: "Spa / Centro de bienestar", en: "Spa / Wellness center" },
      { value: "Consultorio médico", en: "Medical practice" },
      { value: "Clínica dental", en: "Dental clinic" },
      { value: "Psicología / Terapia", en: "Psychology / Therapy" },
    ],
  },
  {
    value: "Belleza",
    en: "Beauty",
    types: [
      { value: "Salón de belleza", en: "Beauty salon" },
      { value: "Barbería", en: "Barbershop" },
      { value: "Nail spa", en: "Nail spa" },
    ],
  },
  {
    value: "Fitness",
    en: "Fitness",
    types: [
      { value: "Gimnasio", en: "Gym" },
      { value: "Yoga / Pilates", en: "Yoga / Pilates" },
      { value: "Entrenador personal", en: "Personal trainer" },
    ],
  },
  {
    value: "Moda y retail",
    en: "Fashion and retail",
    types: [
      { value: "Tienda de ropa", en: "Clothing store" },
      { value: "Joyería", en: "Jewelry store" },
      { value: "Tienda en línea", en: "Online store" },
    ],
  },
  {
    value: "Educación",
    en: "Education",
    types: [
      { value: "Academia / Curso", en: "Academy / Course" },
      { value: "Guardería", en: "Daycare" },
    ],
  },
  {
    value: "Servicios profesionales",
    en: "Professional services",
    types: [
      { value: "Consultoría / Contabilidad", en: "Consulting / Accounting" },
      { value: "Bufete legal", en: "Law firm" },
      { value: "Agencia de marketing", en: "Marketing agency" },
    ],
  },
  {
    value: "Bienes raíces y construcción",
    en: "Real estate and construction",
    types: [
      { value: "Inmobiliaria", en: "Real estate agency" },
      { value: "Construcción / Remodelación", en: "Construction / Remodeling" },
    ],
  },
  {
    value: "Automotriz",
    en: "Automotive",
    types: [{ value: "Taller mecánico", en: "Auto repair shop" }],
  },
  {
    value: "Eventos",
    en: "Events",
    types: [
      { value: "Organización de eventos", en: "Event planning" },
      { value: "Fotografía / Video", en: "Photography / Video" },
    ],
  },
  {
    value: "Tecnología",
    en: "Technology",
    types: [{ value: "Software / Apps", en: "Software / Apps" }],
  },
  {
    value: "Mascotas",
    en: "Pets",
    types: [{ value: "Veterinaria / Pet shop", en: "Veterinary clinic / Pet shop" }],
  },
];

export const AUDIENCE_OPTIONS: { value: string; en: string }[] = [
  { value: "Mujeres", en: "Women" },
  { value: "Hombres", en: "Men" },
  { value: "Todos", en: "Everyone" },
  { value: "Empresas", en: "Businesses" },
];

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
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  const { t } = useLanguage();
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
          aria-label={t("Tu público objetivo", "Your target audience")}
          value={customText}
          onChange={(ev) => setCustomText(ev.target.value)}
          placeholder={t("Escribe a quién le hablas...", "Write who you're speaking to...")}
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-wit-ink outline-none placeholder:text-wit-gray"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Enviar", "Send")}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-1 py-2">
      <div className="flex items-start justify-center gap-4">
        {AUDIENCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className="flex flex-col items-center gap-1 transition-transform hover:scale-[1.05] active:scale-95"
          >
            <span className="wit-float text-wit-blue">
              <AudienceIcon value={opt.value} />
            </span>
            <span className="text-center text-[10px] font-semibold leading-tight text-wit-gray">
              {t(opt.value, opt.en)}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setCustomMode(true)}
        className="text-[10px] font-semibold text-wit-gray transition-transform hover:scale-[1.05] hover:text-wit-ink active:scale-95"
      >
        {t("Otro", "Other")}
      </button>
    </div>
  );
}

// Toggle any number of chips, then confirm — unlike a single-select picker,
// tapping a chip here can't submit right away since the client might still
// want to add or remove another range.
export function AgeRangeMultiPicker({ onPick }: { onPick: (value: string) => void }) {
  const { t } = useLanguage();
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
              selected.includes(chip)
                ? "bg-wit-blue text-white"
                : "bg-wit-mist/50 text-wit-ink hover:bg-wit-mist"
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
        {t("Continuar", "Continue")}
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
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [noLogo, setNoLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (noLogo) {
      // Sentinel value read elsewhere (e.g. panel.tsx's OnboardingGate
      // compares answers.logoKey === "Sin logotipo") — must stay exactly
      // this string regardless of display language.
      onPick("Sin logotipo");
      return;
    }
    if (!file) {
      setError(
        t(
          "Sube tu logotipo o marca 'No tengo logotipo'.",
          'Upload your logo or check "I don\'t have a logo".',
        ),
      );
      return;
    }
    setError(null);
    setUploading(true);
    const key = await uploadReferenceFile(file);
    setUploading(false);
    if (!key) {
      setError(
        t(
          "No pudimos subir tu logotipo (PNG, JPG o WebP, máx. 8 MB).",
          "We couldn't upload your logo (PNG, JPG, or WebP, max 8 MB).",
        ),
      );
      return;
    }
    onPick(key);
  }

  return (
    <div className="wit-glass mx-auto flex max-w-[280px] flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <input
        type="file"
        aria-label={t("Tu logotipo", "Your logo")}
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
        {t("No tengo logotipo", "I don't have a logo")}
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleContinue}
        disabled={uploading}
        className="self-center rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
      >
        {uploading ? t("Subiendo...", "Uploading...") : t("Continuar", "Continue")}
      </button>
    </div>
  );
}

// Optional — the generic Omitir link above the question bubble already
// handles "skip entirely," so this only needs to handle the upload path.
export function ProductPhotoUploadPicker({ onPick }: { onPick: (value: string) => void }) {
  const { t } = useLanguage();
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
      setError(
        t(
          "No pudimos subir la foto (PNG, JPG o WebP, máx. 8 MB).",
          "We couldn't upload the photo (PNG, JPG, or WebP, max 8 MB).",
        ),
      );
      return;
    }
    onPick(key);
  }

  return (
    <div className="wit-glass mx-auto flex max-w-[280px] flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <input
        type="file"
        aria-label={t("Foto del producto", "Product photo")}
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
        {uploading ? t("Subiendo...", "Uploading...") : t("Subir", "Upload")}
      </button>
    </div>
  );
}

const FONT_FILE_EXT = /\.(ttf|otf|woff2?)$/i;

// Optional brand font files — onboarding-only (see panel.tsx's
// OnboardingGate). Same "Omitir already handles skip, this only needs the
// upload path" shape as ProductPhotoUploadPicker above, but supports
// several files at once (a family usually needs at least a regular + bold
// weight) instead of just one, staged locally and uploaded together on
// "Continuar" rather than one request per file.
export function FontUploadPicker({ onPick }: { onPick: (value: string) => void }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList) {
    const picked = Array.from(list);
    const accepted = picked.filter((f) => FONT_FILE_EXT.test(f.name));
    setFiles((prev) => [...prev, ...accepted]);
    setError(
      accepted.length < picked.length
        ? t(
            "Solo se aceptan archivos .ttf, .otf, .woff o .woff2.",
            "Only .ttf, .otf, .woff, or .woff2 files are accepted.",
          )
        : null,
    );
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleContinue() {
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    const keys: string[] = [];
    for (const file of files) {
      const key = await uploadReferenceFile(file);
      if (key) keys.push(key);
    }
    setUploading(false);
    if (keys.length === 0) {
      setError(
        t(
          "No pudimos subir tus tipografías. Intenta de nuevo.",
          "We couldn't upload your fonts. Try again.",
        ),
      );
      return;
    }
    onPick(keys.join(","));
  }

  return (
    <div className="mx-auto flex w-full max-w-[280px] flex-col gap-3 rounded-2xl p-4">
      <label className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-wit-ink/20 px-3 py-3 text-center text-xs text-wit-gray hover:border-wit-blue/40">
        <span className="font-semibold text-wit-blue">{t("Elegir archivos", "Choose files")}</span>
        <span>
          {t(
            ".ttf, .otf, .woff o .woff2 — puedes subir varios",
            ".ttf, .otf, .woff, or .woff2 — you can add more than one",
          )}
        </span>
        <input
          type="file"
          aria-label={t("Tus tipografías", "Your fonts")}
          accept=".ttf,.otf,.woff,.woff2"
          multiple
          onChange={(ev) => ev.target.files && addFiles(ev.target.files)}
          className="hidden"
        />
      </label>
      {files.length > 0 ? (
        <ul className="flex w-full flex-col gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-wit-mist/50 px-2.5 py-1.5 text-xs font-medium text-wit-ink"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={t("Quitar archivo", "Remove file")}
                className="shrink-0 text-wit-gray hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void handleContinue()}
        disabled={files.length === 0 || uploading}
        className="self-center rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep disabled:opacity-60"
      >
        {uploading ? t("Subiendo...", "Uploading...") : t("Continuar", "Continue")}
      </button>
    </div>
  );
}

// Wraps FontUploadPicker (files) and GoogleFontPicker (library) behind two
// tabs, tagging whichever one the client finishes with a "upload:"/
// "library:" prefix so the single onPick(value) callback the surrounding
// chat/edit-card flow expects can still tell them apart — see
// panel.tsx's OnboardingGate.finish() and BrandFontCard, which both split
// on that prefix before saving. previewText is the client's own
// company/brand name when it's already known (onboarding asks for it
// first), so a library font actually shows what their brand looks like in
// it instead of a generic sample.
export function FontChoicePicker({
  onPick,
  previewText,
}: {
  onPick: (value: string) => void;
  previewText: string;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"upload" | "library">("upload");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <div className="mx-auto flex gap-1 rounded-full bg-wit-mist/60 p-1">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
            tab === "upload" ? "bg-white text-wit-ink shadow-sm" : "text-wit-gray"
          }`}
        >
          {t("Subir archivo", "Upload file")}
        </button>
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
            tab === "library" ? "bg-white text-wit-ink shadow-sm" : "text-wit-gray"
          }`}
        >
          {t("Elegir de Google Fonts", "Pick from Google Fonts")}
        </button>
      </div>
      {tab === "upload" ? (
        <FontUploadPicker onPick={(value) => onPick(`upload:${value}`)} />
      ) : (
        <GoogleFontPicker
          previewText={previewText}
          onPick={(family) => onPick(`library:${family}`)}
        />
      )}
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
  items: { value: string; label: string }[];
  onSettle: (value: string, index: number) => void;
}) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const centeredRef = useRef(0);
  const [centeredIndex, setCenteredIndex] = useState(0);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const padding = (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

  useEffect(() => {
    onSettleRef.current(items[0].value, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)),
    );
    if (index !== centeredRef.current) {
      centeredRef.current = index;
      setCenteredIndex(index);
      playWheelTick();
    }
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      onSettleRef.current(items[index].value, index);
    }, 140);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      aria-label={t("Selector", "Picker")}
      className="wit-wheel relative overflow-y-scroll"
      style={{ height: WHEEL_HEIGHT, width: 190, scrollSnapType: "y mandatory" }}
    >
      <div aria-hidden="true" style={{ height: padding }} />
      {items.map((item, i) => (
        <div
          key={item.value}
          style={{ height: WHEEL_ITEM_HEIGHT, scrollSnapAlign: "center" }}
          className={`flex items-center justify-center px-2 text-center transition-all duration-150 ${
            i === centeredIndex
              ? "text-sm font-bold text-wit-ink"
              : "text-xs font-medium text-wit-gray opacity-50"
          }`}
        >
          {item.label}
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
  const { t } = useLanguage();
  // One wheel visible at a time — industry first, and only once that's
  // locked in with "Siguiente" does the business-type wheel for it appear,
  // instead of both spinning on screen together.
  const [step, setStep] = useState<"industry" | "type">("industry");
  const [industry, setIndustry] = useState(BUSINESS_INDUSTRIES[0].value);
  const [type, setType] = useState(BUSINESS_INDUSTRIES[0].types[0].value);
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
          aria-label={t("Tu categoría de negocio", "Your business category")}
          value={customText}
          onChange={(ev) => setCustomText(ev.target.value)}
          placeholder={t("Escribe tu tipo de negocio...", "Write your type of business...")}
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-wit-ink outline-none placeholder:text-wit-gray"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-wit-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Enviar", "Send")}
        </button>
      </form>
    );
  }

  if (step === "industry") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <WheelPicker
            items={BUSINESS_INDUSTRIES.map((i) => ({ value: i.value, label: t(i.value, i.en) }))}
            onSettle={setIndustry}
          />
          <button
            type="button"
            onClick={() => setCustomStep("industry")}
            className="shrink-0 rounded-full bg-wit-mist/50 px-3 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
          >
            {t("Otro", "Other")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const entry = BUSINESS_INDUSTRIES.find((i) => i.value === industry);
            setType(entry?.types[0]?.value ?? "");
            setStep("type");
          }}
          className="rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Siguiente", "Next")}
        </button>
      </div>
    );
  }

  const industryEntry = BUSINESS_INDUSTRIES.find((i) => i.value === industry);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <WheelPicker
          items={
            industryEntry?.types.map((ty) => ({ value: ty.value, label: t(ty.value, ty.en) })) ?? []
          }
          onSettle={setType}
        />
        <button
          type="button"
          onClick={() => setCustomStep("type")}
          className="shrink-0 rounded-full bg-wit-mist/50 px-3 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          {t("Otro", "Other")}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep("industry")}
          className="text-xs font-semibold text-wit-gray hover:text-wit-ink"
        >
          {t("Atrás", "Back")}
        </button>
        <button
          type="button"
          onClick={() => onPick(type)}
          className="rounded-full bg-wit-blue px-6 py-2 text-xs font-bold text-white hover:bg-wit-blue-deep"
        >
          {t("Confirmar", "Confirm")}
        </button>
      </div>
    </div>
  );
}
