import { useState } from "react";

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
