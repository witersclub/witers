import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useLanguage } from "../../lib/i18n";

type FontMeta = { family: string; category: string; variants: string[] };

// Fetched once per page load from a static asset (see
// public/assets/google-fonts.json — a trimmed snapshot of the Google Fonts
// Developer API's family list, ~1,900 families) instead of Google's live
// Developer API, which needs an API key we don't have and don't want to
// manage as a secret just for this. The actual font files still come
// straight from Google's CDN (ensureGoogleFontLoaded below) — only the
// browsing list is bundled.
let fontsCache: FontMeta[] | null = null;
let fontsPromise: Promise<FontMeta[]> | null = null;

function loadFontsList(): Promise<FontMeta[]> {
  if (fontsCache) return Promise.resolve(fontsCache);
  if (!fontsPromise) {
    fontsPromise = fetch("/assets/google-fonts.json")
      .then((res) => (res.ok ? (res.json() as Promise<FontMeta[]>) : []))
      .then((data) => {
        fontsCache = data;
        return data;
      })
      .catch(() => []);
  }
  return fontsPromise;
}

const loadedFontFamilies = new Set<string>();

// Injects Google's real @font-face CSS for one family — deduped so
// scrolling/searching back to an already-shown font doesn't add a second
// <link>. Only called for families actually rendered on screen, never the
// whole ~1,900-family list at once.
export function ensureGoogleFontLoaded(family: string): void {
  if (loadedFontFamilies.has(family)) return;
  loadedFontFamilies.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

const CATEGORIES: { id: string; es: string; en: string }[] = [
  { id: "all", es: "Todas", en: "All" },
  { id: "sans-serif", es: "Sans serif", en: "Sans serif" },
  { id: "serif", es: "Serif", en: "Serif" },
  { id: "display", es: "Display", en: "Display" },
  { id: "handwriting", es: "Manuscrita", en: "Handwriting" },
  { id: "monospace", es: "Monoespaciada", en: "Monospace" },
];

const PAGE_SIZE = 30;

// Browsable, visually-styled Google Fonts library — built from scratch to
// match WITERS's own look (wit-glass cards, not Google's stock font
// picker widget), so it reads as part of the app rather than an embedded
// third-party tool. Each result renders live in its own font, using the
// client's own brand/company name as the preview text when available so
// picking a font actually shows what their brand would look like in it.
export function GoogleFontPicker({
  previewText,
  onPick,
}: {
  previewText: string;
  onPick: (family: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [fonts, setFonts] = useState<FontMeta[] | null>(fontsCache);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fontsCache) return;
    void loadFontsList().then(setFonts);
  }, []);

  const filtered = useMemo(() => {
    if (!fonts) return [];
    const q = query.trim().toLowerCase();
    return fonts.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (q && !f.family.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [fonts, query, category]);

  const shown = filtered.slice(0, visible);

  useEffect(() => {
    setVisible(PAGE_SIZE);
    gridRef.current?.scrollTo({ top: 0 });
  }, [query, category]);

  useEffect(() => {
    for (const f of shown) ensureGoogleFontLoaded(f.family);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map((f) => f.family).join("|")]);

  const preview = previewText.trim() || t("Tu marca", "Your brand");

  return (
    <div className="wit-glass mx-auto flex w-full max-w-lg flex-col gap-3 rounded-2xl p-4 shadow-[0_10px_30px_rgba(5,13,40,0.05)]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wit-gray" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Buscar tipografía...", "Search fonts...")}
          className="w-full rounded-full border border-wit-ink/15 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-wit-blue"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
              category === c.id
                ? "bg-wit-blue text-white"
                : "bg-wit-mist/60 text-wit-gray hover:text-wit-ink"
            }`}
          >
            {lang === "en" ? c.en : c.es}
          </button>
        ))}
      </div>

      {!fonts ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-wit-blue/20 border-t-wit-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-xs text-wit-gray">
          {t("No encontramos tipografías con ese nombre.", "No fonts matched that search.")}
        </p>
      ) : (
        <div ref={gridRef} className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
          {shown.map((f) => (
            <button
              key={f.family}
              type="button"
              onClick={() => onPick(f.family)}
              className="rounded-xl border border-wit-ink/10 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-wit-blue/40 hover:bg-wit-blue/5"
            >
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-wit-gray">
                {f.family}
              </p>
              <p
                className="mt-0.5 truncate text-lg text-wit-ink"
                style={{ fontFamily: `"${f.family}", sans-serif` }}
              >
                {preview}
              </p>
            </button>
          ))}
          {visible < filtered.length ? (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="self-center rounded-full bg-wit-mist/60 px-4 py-1.5 text-xs font-semibold text-wit-gray hover:text-wit-ink"
            >
              {t("Ver más", "Show more")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
