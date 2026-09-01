// Shared landing chrome: fixed header + curved navy footer.
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useLanguage, LanguageToggle } from "../../lib/i18n";
import { trackCtaClick } from "../../lib/track-click";
import { useMe } from "../../lib/witers-client";
import {
  CtaPill,
  IconComunidad,
  IconCrecimiento,
  IconEstrategia,
  IconIngenio,
  IconInnovacion,
  WitersLogo,
} from "./brand";

export function SiteHeader({ landing = false }: { landing?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = landing
    ? [
        { href: "#producto", label: t("Producto", "Product") },
        { href: "#funciones", label: t("Funciones", "Features") },
        { href: "#resultados", label: t("Resultados", "Results") },
      ]
    : [
        { href: "/marca", label: t("Branding", "Branding") },
        { href: "/redes", label: t("Redes", "Social") },
        { href: "/pauta", label: t("Campañas de Meta", "Meta Campaigns") },
        { href: "/nuestra-historia", label: t("Nuestra historia", "Our story") },
        { href: "/nuestra-historia#valores", label: t("Comunidad", "Community") },
      ];

  const ctaLabel = signedIn
    ? t("Mi panel", "My panel")
    : landing
      ? t("Empezar ahora", "Start now")
      : t("Unirme a WITERS", "Join WITERS");

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 shadow-[0_1px_0_rgba(10,18,48,0.08)] backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="flex h-[72px] items-center justify-between px-5 md:px-[110px]">
        <Link to="/" aria-label="WITERS inicio">
          <WitersLogo />
        </Link>

        <nav className="hidden items-center gap-4 md:flex 2xl:gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="wit-navlink text-[13px] font-medium text-wit-ink 2xl:text-sm"
            >
              {l.label}
            </a>
          ))}
          {!signedIn ? (
            <Link
              to="/ingresar"
              className="inline-flex items-center whitespace-nowrap rounded-full border border-wit-blue px-4 py-2.5 text-[13px] font-semibold text-wit-ink transition-colors duration-200 hover:bg-wit-blue/5 hover:text-wit-blue 2xl:px-5 2xl:text-sm"
            >
              {t("Ingresar", "Log in")}
            </Link>
          ) : null}
          <CtaPill
            to={signedIn ? "/panel" : "/registro"}
            onClick={() =>
              trackCtaClick(signedIn ? "Mi panel (header)" : "Unirme a WITERS (header)")
            }
          >
            {ctaLabel}
          </CtaPill>
          <LanguageToggle />
        </nav>

        {/* Mobile: a returning client shouldn't have to open the hamburger
            menu just to find "Ingresar" — so it (or "Mi panel", once signed
            in) sits right in the header row, next to the menu button, not
            buried inside it. */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to={signedIn ? "/panel" : "/ingresar"}
            className="inline-flex items-center rounded-full border border-wit-blue px-3.5 py-2 text-xs font-semibold text-wit-ink transition-colors duration-200 hover:bg-wit-blue/5 hover:text-wit-blue"
          >
            {signedIn ? t("Mi panel", "My panel") : t("Ingresar", "Log in")}
          </Link>
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-wit-ink"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            >
              {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-wit-ink/10 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium text-wit-ink"
              >
                {l.label}
              </a>
            ))}
            <CtaPill
              to={signedIn ? "/panel" : "/registro"}
              onClick={() =>
                trackCtaClick(
                  signedIn ? "Mi panel (header móvil)" : "Unirme a WITERS (header móvil)",
                )
              }
            >
              {ctaLabel}
            </CtaPill>
            <LanguageToggle className="self-start" align="left" />
          </div>
        </div>
      ) : null}
    </header>
  );
}

const FOOTER_BADGES = [
  { icon: IconIngenio, es: "INGENIO", en: "INGENUITY" },
  { icon: IconEstrategia, es: "ESTRATEGIA", en: "STRATEGY" },
  { icon: IconInnovacion, es: "INNOVACIÓN", en: "INNOVATION" },
  { icon: IconComunidad, es: "COMUNIDAD", en: "COMMUNITY" },
  { icon: IconCrecimiento, es: "CRECIMIENTO", en: "GROWTH" },
];

export function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="relative mt-24">
      <div className="absolute inset-x-0 top-0 h-16 rounded-b-[100%_100%]" aria-hidden="true" />
      <div className="rounded-t-[48px] bg-wit-navy px-5 pb-10 pt-14 text-white md:rounded-t-[72px] md:px-[110px]">
        <div>
          <div className="flex flex-col items-start gap-10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <svg width="34" height="26" viewBox="0 0 34 26" fill="#0047FF" aria-hidden="true">
                <path
                  d="M0 26V14C0 6 5 1 13 0v6c-4 .8-6 3-6 8h6v12H0Zm21 0V14c0-8 5-13 13-14v6c-4 .8-6 3-6 8h6v12H21Z"
                  transform="scale(0.8)"
                />
              </svg>
              <p className="max-w-xs text-xl font-bold leading-snug">
                {t("EL INGENIO ES LA IDEA QUE", "INGENUITY IS THE IDEA THAT")}{" "}
                <span className="text-wit-blue brightness-150">
                  {t("IMPULSA EL CAMBIO.", "DRIVES CHANGE.")}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-6 sm:grid-cols-5">
              {FOOTER_BADGES.map((b) => (
                <div key={b.es} className="flex flex-col items-center gap-2 text-[#9fb4ff]">
                  <b.icon size={26} />
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-white/85">
                    {t(b.es, b.en)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
            <WitersLogo dark compact />
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70">
              <a href="/marca" className="hover:text-white">
                Branding
              </a>
              <a href="/redes" className="hover:text-white">
                {t("Manejo de redes", "Social Media")}
              </a>
              <a href="/pauta" className="hover:text-white">
                {t("Campañas de Meta", "Meta Campaigns")}
              </a>
              <a href="/nuestra-historia" className="hover:text-white">
                {t("Nuestra historia", "Our story")}
              </a>
              <Link to="/ingresar" className="hover:text-white">
                {t("Ingresar", "Log in")}
              </Link>
              <Link to="/terminos" className="hover:text-white">
                {t("Términos", "Terms")}
              </Link>
              <Link to="/privacidad" className="hover:text-white">
                {t("Privacidad", "Privacy")}
              </Link>
              <a href="mailto:hola@witers.com" className="hover:text-white">
                hola@witers.com
              </a>
            </nav>
            <p className="text-xs text-white/45">
              {t("WITERS. La comunidad del", "WITERS. The community of")}{" "}
              <span className="text-[#9fb4ff]">{t("ingenio", "ingenuity")}</span>.{" "}
              {t("Hecho en México.", "Made in Mexico.")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
