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
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <div
      className={`inline-flex items-center rounded-full border border-wit-ink/15 p-0.5 text-[11px] font-bold ${className}`}
      role="group"
      aria-label="Idioma / Language"
    >
      <button
        type="button"
        onClick={() => setLang("es")}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          lang === "es" ? "bg-wit-blue text-white" : "text-wit-gray hover:text-wit-ink"
        }`}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          lang === "en" ? "bg-wit-blue text-white" : "text-wit-gray hover:text-wit-ink"
        }`}
      >
        EN
      </button>
    </div>
  );
}
