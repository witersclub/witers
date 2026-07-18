import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BatteryFull,
  BookOpen,
  Droplet,
  Facebook,
  FileStack,
  Flower2,
  Heart,
  Instagram,
  Leaf,
  Linkedin,
  Music2,
  Palette,
  PenTool,
  Share2,
  Shapes,
  ShoppingBag,
  Sparkles,
  Type,
  Users,
  Video,
  Wifi,
  X as XIcon,
  Youtube,
} from "lucide-react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { useDraggableMarquee } from "../hooks/use-draggable-marquee";
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/marca")({
  head: () => ({
    meta: [
      { title: "WITERS Brand — Branding y rebranding. WITERS" },
      {
        name: "description",
        content:
          "Diseñamos o renovamos la identidad visual de tu marca para que transmita confianza, profesionalismo y te diferencie de la competencia.",
      },
    ],
  }),
  component: MarcaLanding,
});

function MarcaLanding() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />
      <Hero />
      <QueRecibiras />
      <PorQueBranding />
      <CtaFinal />
      <SiteFooter />
    </div>
  );
}

/* ---------------- 1. HERO ---------------- */

// Real examples of the deliverable — same identity applied across a
// social profile, packaging and a business card. Runs as a small,
// continuous right-to-left marquee (same technique as the "Resultados
// reales" section on the homepage) instead of one static image.
const BRAND_EXAMPLES: { src: string; alt: string }[] = [
  {
    src: "/assets/brand-mockup.webp",
    alt: "Identidad de marca WITERS aplicada a Instagram, vaso, bolsa y tarjeta de presentación",
  },
  { src: "/assets/brand-example-mia.webp", alt: "Identidad de marca MÍA Accesorios" },
  {
    src: "/assets/brand-example-montenegro.webp",
    alt: "Identidad de marca Montenegro, café de especialidad",
  },
  { src: "/assets/brand-example-belle.webp", alt: "Identidad de marca Belle Intimate" },
  { src: "/assets/brand-example-hygge.webp", alt: "Identidad de marca Hygge Home" },
  { src: "/assets/brand-example-fitzone.webp", alt: "Identidad de marca FitZone" },
];

// Twenty example boutique brand names, styled as the kind of concept
// tiles WITERS actually delivers — built with real HTML/CSS (not a
// downscaled photo) so the names stay crisp and legible even this small,
// and the whole thing never shows a mismatched background behind it.
const LOGO_TILES: {
  name: string;
  bg: string;
  text: string;
  icon?: typeof Leaf;
  script?: boolean;
}[] = [
  { name: "LUMINA", bg: "bg-[#e9d3ae]", text: "text-wit-ink", icon: Leaf },
  { name: "NOA", bg: "bg-[#c1425a]", text: "text-white" },
  { name: "LUNEA", bg: "bg-[#4c6b3f]", text: "text-white", icon: Leaf },
  { name: "MÍA", bg: "bg-[#a99bd6]", text: "text-white", icon: Sparkles },
  { name: "ALMA", bg: "bg-[#e9caa0]", text: "text-wit-ink" },
  { name: "B", bg: "bg-[#f3c9d6]", text: "text-[#a83552]" },
  { name: "éclat", bg: "bg-[#e7f1ea]", text: "text-[#c14a52]", script: true },
  { name: "NUVIA", bg: "bg-[#e08a3e]", text: "text-white", icon: Leaf },
  { name: "SERENA", bg: "bg-[#7c5a72]", text: "text-white" },
  { name: "FLORA", bg: "bg-[#c9bce6]", text: "text-[#4a3a6b]", icon: Flower2 },
  { name: "DULCE", bg: "bg-[#eeddbf]", text: "text-wit-ink", icon: Heart },
  { name: "VITALIS", bg: "bg-[#3f6a92]", text: "text-white", icon: Leaf },
  { name: "SANTÉ", bg: "bg-[#e8cfa3]", text: "text-wit-ink", icon: Flower2 },
  { name: "BALANCE", bg: "bg-[#7fa88d]", text: "text-white" },
  { name: "ELLA", bg: "bg-[#d2607d]", text: "text-white" },
  { name: "MARÉ", bg: "bg-[#d9762f]", text: "text-white", icon: ShoppingBag },
  { name: "ZENNA", bg: "bg-[#a99bd6]", text: "text-white" },
  { name: "NUTRIKA", bg: "bg-[#dcead9]", text: "text-[#4a6b4a]", icon: Droplet },
  { name: "ESENCIA", bg: "bg-[#e6cba5]", text: "text-wit-ink", icon: Flower2 },
  { name: "FEMINA", bg: "bg-[#f3b8cb]", text: "text-[#a83552]" },
];

function TabletLogoGrid({ className = "" }: { className?: string }) {
  return (
    <div className={`[perspective:1600px] ${className}`}>
      <div className="rounded-[32px] border-[10px] border-wit-ink bg-wit-ink shadow-[0_60px_120px_rgba(5,13,40,0.4)] transition-transform duration-500 [transform:rotateY(-8deg)_rotateX(3deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
        <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#1a5bff,#0b1f8f)] p-4 sm:p-6">
          <div className="flex items-center justify-between text-[10px] font-semibold text-white/90 sm:text-xs">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <Wifi size={12} strokeWidth={2.25} />
              <BatteryFull size={14} strokeWidth={2} />
            </span>
          </div>

          <div className="mt-3 text-center sm:mt-4">
            <p className="font-wit text-3xl font-extrabold tracking-[0.1em] text-white sm:text-4xl">
              WITERS
            </p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/60 sm:text-[10px]">
              Ingenio que impulsa marcas
            </p>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2 sm:mt-5 sm:gap-2.5">
            {LOGO_TILES.map((t) => (
              <div
                key={t.name}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg shadow-[0_6px_14px_rgba(0,0,0,0.2)] sm:rounded-xl ${t.bg}`}
              >
                {t.icon ? (
                  <t.icon
                    size={11}
                    strokeWidth={1.75}
                    className={`${t.text} sm:h-[14px] sm:w-[14px]`}
                  />
                ) : null}
                <span
                  className={`px-0.5 text-center text-[6px] font-bold leading-none sm:text-[8px] ${t.text} ${
                    t.script ? "italic" : ""
                  }`}
                >
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMarquee() {
  // Duplicated back to back so the track can loop seamlessly.
  const track = [...BRAND_EXAMPLES, ...BRAND_EXAMPLES];
  const { trackRef, dragHandlers } = useDraggableMarquee(track.length);
  return (
    <div className="wit-marquee-mask relative h-[380px] overflow-hidden rounded-[28px] sm:h-[440px] md:h-[500px]">
      <div
        ref={trackRef}
        {...dragHandlers}
        className="flex h-full w-max cursor-grab touch-pan-y gap-4 active:cursor-grabbing"
      >
        {track.map((b, i) => (
          <img
            key={i}
            src={b.src}
            alt={b.alt}
            loading="lazy"
            draggable={false}
            className="aspect-[3/4] h-full shrink-0 rounded-[20px] object-cover shadow-[0_30px_70px_rgba(5,13,40,0.25)]"
          />
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  return (
    <section className="relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="grid items-center gap-12 px-5 md:px-[110px] lg:grid-cols-2 lg:gap-16">
        <div className="wit-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-wit-mist/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue">
            Branding &amp; Rebranding
          </span>
          <div className="relative w-fit">
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tighter text-wit-ink md:text-6xl">
              WITERS
              <br />
              <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
                Brand
              </span>
            </h1>
            {/* Below lg the hero collapses to one column, so the full-size
                tablet (below) lands after the CTA instead of beside the
                title. This small scaled-down copy fills that spot on
                narrow screens — same tablet, just shrunk via CSS transform
                so all 20 tiles stay proportionally correct, not redrawn. */}
            <div
              aria-hidden="true"
              className="wit-float pointer-events-none absolute left-full top-0 z-10 ml-[1.3cm] origin-top-left scale-[0.27] rotate-[6deg] lg:hidden"
            >
              <TabletLogoGrid className="w-[320px]" />
            </div>
          </div>
          <p className="mt-5 text-2xl font-bold leading-snug text-wit-ink">
            Construimos la identidad que{" "}
            <span className="italic text-wit-blue">hará crecer tu negocio</span>.
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-wit-gray">
            Diseñamos o renovamos la identidad visual de tu marca para que transmita confianza,
            profesionalismo y te diferencie de la competencia.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              to={signedIn ? "/panel" : "/registro"}
              className="group inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-8 py-4 text-base font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
            >
              Quiero mi identidad de marca
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
              >
                <path d="M3 13 13 3M13 3H6M13 3v7" />
              </svg>
            </Link>
            <a href="#que-recibiras" className="wit-navlink text-sm font-semibold text-wit-ink">
              Ver qué incluye
            </a>
          </div>
        </div>

        <div className="wit-rise wit-rise-d1 wit-float mx-auto hidden w-full max-w-lg lg:block">
          <TabletLogoGrid />
        </div>
      </div>

      <div className="wit-rise wit-rise-d2 mt-16 px-5 md:mt-20 md:px-[110px]">
        <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.3em] text-wit-gray lg:text-left">
          Ejemplos de identidades que ya entregamos
        </p>
        <HeroMarquee />
      </div>
    </section>
  );
}

/* ---------------- 2. QUÉ RECIBIRÁS ---------------- */

type Recibe = {
  icon: typeof PenTool;
  title: string;
  text: string;
  receipt: () => ReactNode;
};

function LogoChips() {
  const chips: { bg: string; logo: string }[] = [
    { bg: "bg-white ring-1 ring-white/20", logo: "/assets/logo_w.png" },
    { bg: "bg-wit-blue", logo: "/assets/logo_w_white.png" },
    { bg: "bg-wit-ink ring-1 ring-white/10", logo: "/assets/logo_w_white.png" },
  ];
  return (
    <div className="flex gap-2">
      {chips.map((c, i) => (
        <span
          key={i}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${c.bg}`}
        >
          <img src={c.logo} alt="" className="h-6 w-auto" draggable={false} />
        </span>
      ))}
    </div>
  );
}

function PaletteChips() {
  const colors = ["#050d28", "#0047ff", "#5c85ff", "#b7c9ff"];
  return (
    <div className="flex h-14 w-full max-w-[220px] overflow-hidden rounded-xl">
      {colors.map((c) => (
        <span key={c} className="flex-1" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

function TypeSample() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5">
      <span className="font-wit text-2xl font-extrabold text-wit-ink">Aa</span>
      <span className="h-8 w-px bg-wit-ink/10" aria-hidden="true" />
      <div className="text-[11px] leading-tight text-wit-gray">
        <p className="font-semibold text-wit-ink">Montserrat</p>
        <p>Poppins</p>
      </div>
    </div>
  );
}

function ElementChips() {
  return (
    <div className="flex gap-2">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white">
        <span className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-wit-blue" />
          ))}
        </span>
      </span>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white">
        <span className="block h-6 w-6 rounded-full border-[3px] border-wit-blue" />
      </span>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white">
        <svg width="26" height="16" viewBox="0 0 26 16" fill="none" aria-hidden="true">
          <path
            d="M0 8c2.2-6 4.3-6 6.5 0s4.3 6 6.5 0 4.3-6 6.5 0 4.3 6 6.5 0"
            stroke="#0047FF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
}

function ManualPreview() {
  return (
    <img
      src="/assets/brand-manual.webp"
      alt="Ejemplo de manual de identidad WITERS"
      className="h-[92px] w-auto rounded-lg object-cover"
    />
  );
}

const FORMATOS = [
  { label: "Ai", bg: "#e8770c" },
  { label: "PDF", bg: "#d6301f" },
  { label: "SVG", bg: "#7a3ff2" },
  { label: "PNG", bg: "#0047ff" },
  { label: "JPG", bg: "#1a9e5c" },
];

function FormatChips() {
  return (
    <div className="flex max-w-[190px] flex-wrap gap-1.5">
      {FORMATOS.map((f) => (
        <span
          key={f.label}
          className="rounded-md px-2 py-1 text-[10px] font-extrabold text-white"
          style={{ backgroundColor: f.bg }}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}

const REDES = [Instagram, Facebook, Linkedin, Music2, Youtube, XIcon];

function SocialChips() {
  return (
    <div className="flex max-w-[190px] flex-wrap gap-2">
      {REDES.map((Icon, i) => (
        <span
          key={i}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-wit-ink"
        >
          <Icon size={15} strokeWidth={2} />
        </span>
      ))}
    </div>
  );
}

function AsesoriaPreview() {
  return (
    <div className="flex h-[70px] w-[150px] items-center justify-center gap-2 rounded-xl bg-white/10">
      <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        En vivo
      </span>
      <Video className="text-white/70" size={20} strokeWidth={1.75} />
    </div>
  );
}

const RECIBE: Recibe[] = [
  {
    icon: PenTool,
    title: "3 conceptos de marca",
    text: "Desarrollamos 3 propuestas originales de logotipo basadas en la esencia de tu negocio. Incluye hasta 2 rondas de ajustes.",
    receipt: () => <LogoChips />,
  },
  {
    icon: Palette,
    title: "Paleta de colores",
    text: "Seleccionamos los colores ideales para que tu marca sea reconocible y consistente.",
    receipt: () => <PaletteChips />,
  },
  {
    icon: Type,
    title: "Tipografías oficiales",
    text: "Elegimos las fuentes perfectas para comunicar profesionalismo y coherencia.",
    receipt: () => <TypeSample />,
  },
  {
    icon: Shapes,
    title: "Elementos gráficos de apoyo",
    text: "Recursos visuales que le darán personalidad y coherencia a tu marca.",
    receipt: () => <ElementChips />,
  },
  {
    icon: BookOpen,
    title: "Manual de identidad",
    text: "Guía práctica con las reglas para usar tu marca correctamente.",
    receipt: () => <ManualPreview />,
  },
  {
    icon: FileStack,
    title: "Archivos listos para todo",
    text: "Entregamos tu marca en todos los formatos que necesitas: AI, PDF, SVG, PNG, JPG.",
    receipt: () => <FormatChips />,
  },
  {
    icon: Share2,
    title: "Versiones para redes sociales",
    text: "Adaptamos tu logotipo para que luzca perfecto en cada plataforma.",
    receipt: () => <SocialChips />,
  },
  {
    icon: Users,
    title: "Asesoría personalizada",
    text: "Sesión final para explicarte cómo usar tu marca y sacarle el máximo provecho.",
    receipt: () => <AsesoriaPreview />,
  },
];

function QueRecibiras() {
  return (
    <section id="que-recibiras" className="relative overflow-hidden bg-wit-navy py-20 md:py-28">
      <div className="relative px-5 md:px-[110px]">
        <div className="flex items-center justify-center gap-4">
          <DotFlourish />
          <h2 className="text-center text-3xl font-extrabold uppercase tracking-wide text-white md:text-4xl">
            ¿Qué recibirás?
          </h2>
          <DotFlourish />
        </div>

        <ol className="mx-auto mt-14 max-w-3xl divide-y divide-white/10">
          {RECIBE.map((r, i) => (
            <li
              key={r.title}
              className="flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-wit-blue text-white">
                <r.icon size={24} strokeWidth={1.75} />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                  {i + 1}. {r.title}
                </h3>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/65">{r.text}</p>
              </div>
              <div className="shrink-0 sm:pl-2">{r.receipt()}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function DotFlourish() {
  return (
    <span className="hidden grid-cols-4 gap-1.5 sm:grid" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-white/25" />
      ))}
    </span>
  );
}

/* ---------------- 3. POR QUÉ EL BRANDING IMPORTA ---------------- */

const PORQUE = [
  {
    icon: Sparkles,
    title: "Es tu primera venta",
    text: "Antes de conocer tu producto, la gente ya se formó una opinión de tu negocio — por tu logo, tus colores, tu presencia.",
  },
  {
    icon: Users,
    title: "Construye confianza",
    text: "Una identidad consistente hace que tu marca se vea establecida y profesional, no improvisada.",
  },
  {
    icon: Shapes,
    title: "Te diferencia",
    text: "En un feed lleno de competencia, una marca con identidad propia es la que se recuerda.",
  },
  {
    icon: Share2,
    title: "Funciona en todos lados",
    text: "Redes, empaque, tarjetas, sitio web — tu marca se ve igual de bien en cualquier lugar donde aparezca.",
  },
];

function PorQueBranding() {
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">Por qué</p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            Importa el branding
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2">
          {PORQUE.map((d) => (
            <div key={d.title} className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                <d.icon size={22} strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-base font-bold text-wit-ink">{d.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-wit-gray">{d.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 4. CTA FINAL ---------------- */

function CtaFinal() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  return (
    <section className="relative bg-white py-16 md:py-20">
      <div className="flex flex-col items-start gap-8 border-t border-wit-ink/10 px-5 pt-14 md:flex-row md:items-center md:justify-between md:px-[110px]">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
            Tu marca merece verse
            <br />
            tan bien como <span className="italic text-wit-blue">vende</span>.
          </h2>
          <p className="mt-3 text-sm text-wit-gray">Cotización personalizada según tu marca.</p>
        </div>
        <Link
          to={signedIn ? "/panel" : "/registro"}
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-wit-ink/15 bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.08)] transition-all duration-200 hover:bg-wit-ink hover:text-white active:scale-[0.98]"
        >
          Quiero mi identidad de marca
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
          >
            <path d="M3 13 13 3M13 3H6M13 3v7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
