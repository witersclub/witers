// Manual ES/EN toggle for public pages + the client panel (never the staff
// panels — those stay Spanish-only, this app's internal team is Mexican).
// No dictionary file: translations live inline at the call site via
// t("texto en español", "matching English text"), so a string and its
// translation are always visible together and never drift out of sync the
// way a separate key->text JSON file would. Persisted in localStorage so a
// visitor's choice survives across pages and future visits; SSR always
// renders "es" first (no localStorage on the server) and may flip to "en"
// once the client reads the stored preference, same tradeoff any
// client-only preference toggle (e.g. dark mode) makes.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Globe } from "lucide-react";

export type Lang = "es" | "en";

const STORAGE_KEY = "witers-lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (es: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const t = (es: string, en: string) => (lang === "en" ? en : es);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export function LanguageToggle({
  className = "",
  align = "right",
}: {
  className?: string;
  // Desktop nav: the toggle sits at the far right, so the dropdown must
  // hang off its right edge to stay under it. The mobile menu instead
  // left-aligns the toggle near the screen edge — anchoring the dropdown
  // to the right there pushed most of its width past the left edge of the
  // viewport, clipping it almost entirely.
  align?: "left" | "right";
}) {
  const { lang, setLang, t } = useLanguage();
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
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("Cambiar idioma", "Change language")}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-wit-ink/15 text-wit-gray transition-colors hover:border-wit-blue/40 hover:text-wit-blue"
      >
        <Globe size={18} strokeWidth={2} />
      </button>

      {open ? (
        <div
          className={`absolute top-full z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-wit-ink/10 bg-white py-1.5 shadow-[0_20px_50px_rgba(5,13,40,0.15)] ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setLang(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                lang === opt.value ? "text-wit-blue" : "text-wit-ink hover:bg-wit-mist/50"
              }`}
            >
              {opt.label}
              {lang === opt.value ? <Check size={16} strokeWidth={2.5} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
