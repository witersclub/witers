// Shared landing chrome: fixed header + curved navy footer.
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/marca", label: "Branding" },
    { href: "/pauta", label: "Campañas de Meta" },
    { href: "/nuestra-historia", label: "Nuestra historia" },
    { href: "/nuestra-historia#valores", label: "Comunidad" },
    { href: "#membresia", label: "Membresía" },
  ];

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

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="wit-navlink text-sm font-medium text-wit-ink">
              {l.label}
            </a>
          ))}
          {!signedIn ? (
            <Link
              to="/ingresar"
              className="inline-flex items-center rounded-full border border-wit-blue px-5 py-2.5 text-sm font-semibold text-wit-ink transition-colors duration-200 hover:bg-wit-blue/5 hover:text-wit-blue"
            >
              Ingresar
            </Link>
          ) : null}
          <CtaPill to={signedIn ? "/panel" : "/registro"}>
            {signedIn ? "Mi panel" : "Unirme a WITERS"}
          </CtaPill>
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
            {signedIn ? "Mi panel" : "Ingresar"}
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
            <CtaPill to={signedIn ? "/panel" : "/registro"}>
              {signedIn ? "Mi panel" : "Unirme a WITERS"}
            </CtaPill>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const FOOTER_BADGES = [
  { icon: IconIngenio, label: "INGENIO" },
  { icon: IconEstrategia, label: "ESTRATEGIA" },
  { icon: IconInnovacion, label: "INNOVACIÓN" },
  { icon: IconComunidad, label: "COMUNIDAD" },
  { icon: IconCrecimiento, label: "CRECIMIENTO" },
];

export function SiteFooter() {
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
                EL INGENIO ES LA IDEA QUE{" "}
                <span className="text-wit-blue brightness-150">IMPULSA EL CAMBIO.</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-6 sm:grid-cols-5">
              {FOOTER_BADGES.map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-2 text-[#9fb4ff]">
                  <b.icon size={26} />
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-white/85">
                    {b.label}
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
              <a href="/pauta" className="hover:text-white">
                Campañas de Meta
              </a>
              <a href="/nuestra-historia" className="hover:text-white">
                Nuestra historia
              </a>
              <a href="#membresia" className="hover:text-white">
                Membresía
              </a>
              <Link to="/ingresar" className="hover:text-white">
                Ingresar
              </Link>
              <a href="mailto:hola@witers.com" className="hover:text-white">
                hola@witers.com
              </a>
            </nav>
            <p className="text-xs text-white/45">
              WITERS. La comunidad del <span className="text-[#9fb4ff]">ingenio</span>. Hecho en
              México.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
