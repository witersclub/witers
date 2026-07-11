import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import {
  IconCerebro,
  IconColaboracion,
  IconComunidad,
  IconCrecimiento,
  IconEstrategia,
  IconEvolucion,
  IconExcelencia,
  IconIngenio,
  IconInnovacion,
  IconMision,
  IconProposito,
  IconVision,
  WMark,
} from "../components/witers/brand";
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WITERS. La comunidad del ingenio" },
      {
        name: "description",
        content:
          "Comunidad de branding, marketing, inteligencia artificial y tecnología. Únete a WITERS y genera creatividades publicitarias con IA.",
      },
    ],
    links: [{ rel: "canonical", href: "https://witers.example/" }],
  }),
  component: Landing,
});

// Scroll-linked parallax (transform only, never opacity-to-zero).
function useParallax(factor: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        el.style.transform = `translateY(${(-center * factor).toFixed(1)}px)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [factor]);
  return ref;
}

function Landing() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <HeroVideoBackground />
      <SiteHeader />
      <Hero />
      <ClientesSatisfechos />
      <QuienesSomos />
      <Filosofia />
      <Valores />
      <Proposito />
      <Historia />
      <Manifiesto />
      <MisionVision />
      <Membresia />
      <Faq />
      <SiteFooter />
    </div>
  );
}

/* ---------------- 1. HERO ---------------- */

// Fixed, not part of the Hero section — this is what makes it a true page
// background instead of a hero-only banner. It's the first element in the
// DOM (before every section), no z-index set: later opaque sections simply
// paint over it in normal stacking order as they scroll into view, the same
// technique already verified for .wit-bg-fixed elsewhere in this app. Never
// use z-index:-1 here — that sinks it below the page's own white canvas and
// hides it entirely.
function HeroVideoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <video
        src="/assets/banner-witers.mp4"
        poster="/assets/hero-banner.png"
        preload="auto"
        autoPlay
        muted
        loop
        playsInline
        className="wit-hero-video h-full w-full object-cover"
      />
      {/* Difuminado blanco fuerte — el video queda de fondo, pero lo que
          importa (título, botón, carrusel) tiene que resaltar por encima. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,white_0%,white_40%,rgba(255,255,255,0.75)_65%,rgba(255,255,255,0.2)_100%)]" />
    </div>
  );
}

function Hero() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);

  return (
    <section className="relative overflow-hidden pb-14 pt-28 md:pb-20 md:pt-36">
      {/* Logo flotante en la esquina superior derecha */}
      <img
        src="/assets/witers-logo-full.png"
        alt=""
        aria-hidden="true"
        className="wit-float absolute right-6 top-6 hidden h-[160px] w-auto md:block"
      />

      <div className="relative px-5 md:px-[110px]">
        <h1 className="wit-rise text-4xl font-extrabold leading-tight tracking-tighter text-wit-ink md:text-6xl">
          Elevemos tu <span className="text-wit-blue">marca</span>
        </h1>
        <div className="wit-rise wit-rise-d1 mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            to={signedIn ? "/panel" : "/registro"}
            className="group inline-flex items-center gap-2.5 rounded-full bg-wit-blue px-7 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:bg-wit-blue-deep active:scale-[0.98]"
          >
            Unirme ahora
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1">
              <path d="M3 13 13 3M13 3H6M13 3v7" />
            </svg>
          </Link>
          <a href="#quienes-somos" className="wit-navlink text-sm font-semibold text-wit-ink">
            Conocer la comunidad
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1b. CLIENTES SATISFECHOS ---------------- */

// Placeholder slots shown only until the first "cerrada" (finalized) client
// request exists — same visual size regardless of the format label, so the
// marquee row stays uniform either way.
const PIEZAS_EJEMPLO = [
  { label: "Post cuadrado", ratio: "1:1" },
  { label: "Historia", ratio: "9:16" },
  { label: "Banner", ratio: "16:9" },
  { label: "Post vertical", ratio: "3:4" },
  { label: "Post cuadrado", ratio: "1:1" },
  { label: "Historia", ratio: "9:16" },
];

type ShowcasePiece = { id: string; r2_key: string | null; image_url: string | null; title: string };

type Card =
  | { key: string; kind: "real"; src: string; alt: string }
  | { key: string; kind: "placeholder"; label: string; ratio: string };

function ClientesSatisfechos() {
  const showcase = useQuery({
    queryKey: ["public-showcase"],
    queryFn: async () => {
      const res = await fetch("/api/public/showcase");
      if (!res.ok) return { ok: false, pieces: [] as ShowcasePiece[] };
      return (await res.json()) as { ok: boolean; pieces: ShowcasePiece[] };
    },
    staleTime: 60_000,
  });

  const realPieces = showcase.data?.pieces ?? [];
  const cards: Card[] =
    realPieces.length > 0
      ? realPieces.map((p) => ({
          key: p.id,
          kind: "real",
          src: p.image_url ?? `/api/public/showcase-image?key=${encodeURIComponent(p.r2_key ?? "")}`,
          alt: p.title,
        }))
      : PIEZAS_EJEMPLO.map((p, i) => ({ key: `ph-${i}`, kind: "placeholder", label: p.label, ratio: p.ratio }));
  const piezas = [...cards, ...cards.map((c) => ({ ...c, key: `${c.key}-2` }))];

  return (
    <section className="relative bg-white py-16 md:py-20">
      <div className="px-5 md:px-[110px]">
        <h2 className="wit-rise text-3xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
          Clientes <span className="wit-underline text-wit-blue">satisfechos</span>
        </h2>
      </div>

      <div className="wit-marquee-mask relative mt-10 overflow-hidden">
        <div className="wit-marquee-track flex w-max gap-5 px-5">
          {piezas.map((p) =>
            p.kind === "real" ? (
              <img
                key={p.key}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                className="h-56 w-40 shrink-0 rounded-2xl object-cover shadow-[0_10px_30px_rgba(5,13,40,0.06)] transition-transform duration-300 hover:scale-[1.04]"
              />
            ) : (
              <div
                key={p.key}
                className="wit-glass flex h-56 w-40 shrink-0 flex-col items-center justify-center gap-3 rounded-2xl shadow-[0_10px_30px_rgba(5,13,40,0.06)] transition-transform duration-300 hover:scale-[1.04]"
              >
                <WMark size={30} />
                <div className="text-center">
                  <p className="text-xs font-bold text-wit-ink">{p.label}</p>
                  <p className="text-[11px] text-wit-gray">{p.ratio}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 2. QUIÉNES SOMOS ---------------- */

const PILLARS = [
  {
    icon: IconEstrategia,
    text: (
      <>
        En <strong className="text-wit-blue">WITERS</strong> reunimos branding, marketing,
        inteligencia artificial y tecnología para ayudar a empresas y emprendedores a construir
        marcas con propósito, crecer de manera inteligente y alcanzar su máximo potencial.
      </>
    ),
  },
  {
    icon: IconIngenio,
    text: (
      <>
        Más que ofrecer servicios, creamos experiencias, herramientas y soluciones que facilitan el
        crecimiento de nuestra comunidad. Cada estrategia y cada diseño nace con un mismo objetivo:
        transformar grandes ideas en <strong className="text-wit-blue">resultados extraordinarios</strong>.
      </>
    ),
  },
  {
    icon: IconCerebro,
    text: (
      <>
        Creemos que el conocimiento compartido genera <strong className="text-wit-blue">oportunidades</strong>,
        que la creatividad encuentra su mayor valor respaldada por la{" "}
        <strong className="text-wit-blue">estrategia</strong> y que la innovación cobra sentido
        cuando produce un <strong className="text-wit-blue">impacto real</strong>.
      </>
    ),
  },
];

function QuienesSomos() {
  return (
    <section id="quienes-somos" className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <h2 className="text-4xl font-extrabold tracking-tighter text-wit-ink md:text-6xl">
          ¿Quiénes <span className="wit-underline text-wit-blue">Somos?</span>
        </h2>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {PILLARS.map((p, i) => (
            <article key={i} className={i > 0 ? "md:border-l md:border-wit-ink/10 md:pl-8" : ""}>
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                <p.icon size={30} />
              </span>
              <p className="mt-5 text-[15px] leading-relaxed text-wit-gray">{p.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start gap-5 border-t border-wit-ink/10 pt-10 md:flex-row md:items-center">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
            <IconCrecimiento size={26} />
          </span>
          <p className="max-w-3xl text-lg leading-relaxed text-wit-ink">
            Ser parte de <strong className="text-wit-blue">WITERS</strong> significa formar parte de
            una comunidad que evoluciona constantemente, donde el{" "}
            <strong className="text-wit-blue">ingenio</strong> se convierte en{" "}
            <strong className="text-wit-blue">acción</strong> y el crecimiento es una{" "}
            <strong className="text-wit-blue">experiencia compartida</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 3. FILOSOFÍA ---------------- */

const FILO_PILLS = [
  { icon: IconIngenio, label: "Ingenio" },
  { icon: IconEstrategia, label: "Estrategia" },
  { icon: IconExcelencia, label: "Creatividad" },
  { icon: IconEvolucion, label: "Evolución" },
];

function Filosofia() {
  const imgRef = useParallax(0.05);
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="grid items-center gap-12 px-5 md:grid-cols-[0.95fr_1.05fr] md:px-[110px]">
        <div className="order-2 md:order-1">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">Nuestra</p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-blue md:text-6xl">
            Filosofía
          </h2>
          <p className="mt-8 max-w-md text-2xl font-semibold leading-snug text-wit-ink">
            Creemos que el <span className="text-wit-blue">ingenio</span> es el motor que impulsa la{" "}
            <span className="text-wit-blue">evolución</span>.
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-wit-gray">
            Cada idea tiene el potencial de convertirse en una gran oportunidad cuando encuentra la{" "}
            <strong className="text-wit-ink">estrategia</strong> adecuada, la{" "}
            <strong className="text-wit-ink">creatividad</strong> correcta y las{" "}
            <strong className="text-wit-ink">herramientas</strong> para desarrollarse.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {FILO_PILLS.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-white px-4 py-2 text-sm font-semibold text-wit-blue"
              >
                <p.icon size={18} />
                {p.label}
              </span>
            ))}
          </div>
        </div>
        <div ref={imgRef} className="order-1 will-change-transform md:order-2">
          <img
            src="/assets/sphere.webp"
            alt="Esfera de partículas azul brillando sobre un podio blanco"
            width={1400}
            height={1400}
            className="mx-auto w-full max-w-lg"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- 4. VALORES ---------------- */

const VALORES = [
  {
    icon: IconIngenio,
    label: "Ingenio",
    text: "Encontramos oportunidades donde otros ven desafíos y convertimos las ideas en soluciones inteligentes.",
    angle: -90,
  },
  {
    icon: IconInnovacion,
    label: "Innovación",
    text: "Exploramos nuevas formas de crear, aprender y evolucionar constantemente.",
    angle: -30,
  },
  {
    icon: IconEstrategia,
    label: "Estrategia",
    text: "Cada decisión responde a un propósito y cada acción acerca a nuestros clientes a sus objetivos.",
    angle: 30,
  },
  {
    icon: IconExcelencia,
    label: "Excelencia",
    text: "Cuidamos cada detalle para ofrecer experiencias, servicios y resultados de la más alta calidad.",
    angle: 90,
  },
  {
    icon: IconColaboracion,
    label: "Colaboración",
    text: "Creemos en el poder de construir, compartir y crecer juntos como comunidad.",
    angle: 150,
  },
  {
    icon: IconEvolucion,
    label: "Evolución",
    text: "El crecimiento continuo forma parte de nuestra esencia. Siempre existe un siguiente nivel por alcanzar.",
    angle: 210,
  },
];

function Valores() {
  return (
    <section id="valores" className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="grid items-start gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">Nuestros</p>
            <h2 className="wit-underline mt-1 text-5xl font-extrabold tracking-tighter text-wit-ink md:text-6xl">
              Valores
            </h2>
            <p className="mt-8 max-w-sm text-lg leading-relaxed text-wit-gray">
              Nuestros valores son el núcleo que guía cada decisión, cada estrategia y cada relación
              que construimos.
            </p>
          </div>

          {/* radial diagram on desktop, list on mobile */}
          <div>
            <div className="relative mx-auto hidden aspect-square max-w-[560px] lg:block">
              <div className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-wit-blue/15" />
              <div className="absolute left-1/2 top-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_18px_50px_rgba(0,71,255,0.16)]">
                <WMark size={72} />
              </div>
              {VALORES.map((v) => {
                const rad = (v.angle * Math.PI) / 180;
                const x = 50 + 40 * Math.cos(rad);
                const y = 50 + 40 * Math.sin(rad);
                return (
                  <div
                    key={v.label}
                    className="group absolute w-40 -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-wit-blue shadow-[0_10px_30px_rgba(5,13,40,0.12)] transition-transform duration-200 group-hover:scale-110">
                      <v.icon size={28} />
                    </span>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-wit-blue">
                      {v.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-wit-gray">{v.text}</p>
                  </div>
                );
              })}
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:hidden">
              {VALORES.map((v) => (
                <li key={v.label} className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                    <v.icon size={24} />
                  </span>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-wit-blue">{v.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-wit-gray">{v.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 5. PROPÓSITO ---------------- */

function Proposito() {
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-24">
      <div className="grid items-center gap-10 px-5 md:grid-cols-2 md:px-[110px]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-wit-mist/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-wit-blue">
            <IconProposito size={16} />
            Propósito
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            Nuestro <span className="wit-underline text-wit-blue">Propósito</span>
          </h2>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-wit-gray">
            <strong className="text-wit-blue">Inspirar</strong> y{" "}
            <strong className="text-wit-blue">potenciar</strong> a personas, emprendedores y
            empresas para que descubran el valor de sus ideas y las conviertan en proyectos capaces
            de generar <strong className="text-wit-ink">impacto</strong>,{" "}
            <strong className="text-wit-ink">crecimiento</strong> y{" "}
            <strong className="text-wit-ink">legado</strong>.
          </p>
        </div>
        <img
          src="/assets/mountain.webp"
          alt="Montaña low-poly blanca con bandera azul en la cima y camino de luz"
          width={1400}
          height={1400}
          className="mx-auto w-full max-w-md"
          loading="lazy"
        />
      </div>
    </section>
  );
}

/* ---------------- 6. HISTORIA ---------------- */

const HISTORIA = [
  {
    icon: IconIngenio,
    text: (
      <>
        Toda gran transformación comienza con una idea. Pero detrás de cada idea capaz de cambiar
        una empresa, una marca o una industria, existe un elemento indispensable:{" "}
        <strong className="text-wit-blue">el ingenio</strong>.
      </>
    ),
  },
  {
    word: "Wit",
    text: (
      <>
        La palabra <strong className="text-wit-blue">Wit</strong>, en inglés, representa la agilidad
        mental, la creatividad y la capacidad de encontrar soluciones que generan impacto. Ese
        concepto fue la inspiración para crear <strong className="text-wit-blue">WITERS</strong>.
      </>
    ),
  },
  {
    icon: IconComunidad,
    text: (
      <>
        Sin embargo, <strong className="text-wit-blue">WITERS</strong> es mucho más que un nombre.
        Es una filosofía. Una forma de pensar, crear y actuar. Un{" "}
        <strong className="text-wit-blue">Witer</strong> es quien transforma los desafíos en
        oportunidades, combina estrategia con creatividad y convierte las ideas en resultados.
      </>
    ),
  },
  {
    icon: IconColaboracion,
    text: (
      <>
        Creemos que el ingenio es el recurso más poderoso para impulsar el crecimiento. Por eso
        decidimos evolucionar el concepto tradicional de una agencia de marketing y construir una{" "}
        <strong className="text-wit-blue">comunidad</strong> donde empresas, emprendedores,
        creadores y profesionales encuentran las herramientas, el conocimiento y las estrategias
        necesarias para crecer juntos.
      </>
    ),
  },
  {
    icon: IconEvolucion,
    text: (
      <>
        Nuestro símbolo representa esa visión. La flecha integrada en la W simboliza el{" "}
        <strong className="text-wit-blue">movimiento</strong>, la{" "}
        <strong className="text-wit-blue">evolución constante</strong> y la determinación de avanzar
        siempre hacia el <strong className="text-wit-blue">siguiente nivel</strong>. Es un
        recordatorio de que el crecimiento nunca se detiene y de que cada paso impulsa el siguiente.
      </>
    ),
  },
  {
    icon: IconExcelencia,
    text: (
      <>
        En <strong className="text-wit-blue">WITERS</strong> no solo desarrollamos marcas.
        Construimos una comunidad donde el ingenio conecta personas, impulsa negocios y transforma
        ideas en proyectos extraordinarios.
      </>
    ),
  },
];

function Historia() {
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="lg:sticky lg:top-28">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-ink">Nuestra</p>
              <h2 className="wit-underline mt-1 text-5xl font-extrabold tracking-tighter text-wit-blue md:text-6xl">
                Historia
              </h2>
              <img
                src="/assets/hero_w.webp"
                alt=""
                aria-hidden="true"
                width={700}
                height={700}
                className="mt-10 hidden w-full max-w-xs lg:block"
                loading="lazy"
              />
            </div>
          </div>

          <ol className="relative border-l-2 border-wit-blue/20 pl-8">
            {HISTORIA.map((h, i) => (
              <li key={i} className="relative pb-10 last:pb-0">
                <span className="absolute -left-[45px] flex h-8 w-8 items-center justify-center rounded-full bg-wit-blue text-xs font-bold text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                    {"word" in h && h.word ? (
                      <span className="text-sm font-extrabold">Wit</span>
                    ) : h.icon ? (
                      <h.icon size={24} />
                    ) : null}
                  </span>
                  <p className="text-[15px] leading-relaxed text-wit-gray">{h.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 7. MANIFIESTO ---------------- */

const CREEMOS_A = [
  "CREEMOS en el poder de las ideas que se atreven a ser diferentes.",
  "CREEMOS que la estrategia convierte la creatividad en resultados.",
  "CREEMOS que la tecnología existe para multiplicar el talento humano.",
  "CREEMOS que compartir conocimiento nos hace más fuertes.",
];
const CREEMOS_B = [
  "CREEMOS que cada marca tiene una historia que merece ser contada.",
  "CREEMOS que el crecimiento es un camino que se recorre en comunidad.",
  "CREEMOS que la excelencia está en los detalles.",
  "CREEMOS que el ingenio es la idea que impulsa el cambio.",
];

function Manifiesto() {
  return (
    <section className="relative overflow-hidden bg-wit-navy py-20 text-white md:py-28">
      <div className="px-5 md:px-[110px]">
        <h2 className="text-4xl font-extrabold tracking-tighter md:text-5xl">
          Nuestro <span className="wit-underline text-[#5c85ff]">Manifiesto</span>
        </h2>

        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {[CREEMOS_A, CREEMOS_B].map((col, ci) => (
              <ul key={ci} className="space-y-5">
                {col.map((c) => (
                  <li key={c} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                    <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-wit-blue brightness-150" />
                    <span>
                      <strong className="font-extrabold text-white">CREEMOS</strong>
                      {c.replace("CREEMOS", "")}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>

          <figure className="overflow-hidden rounded-3xl">
            <img
              src="/assets/corridor.webp"
              alt="Persona caminando por un corredor de luz hacia el logotipo W"
              width={1800}
              height={1013}
              className="w-full"
              loading="lazy"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 8. MISIÓN / VISIÓN ---------------- */

function MisionVision() {
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="grid gap-8 px-5 lg:grid-cols-2 md:px-[110px]">
        <article className="group overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(5,13,40,0.08)]">
          <div className="overflow-hidden">
            <img
              src="/assets/stairs_mission.webp"
              alt="Escalera blanca ascendiendo hacia una puerta en forma de flecha azul"
              width={1400}
              height={1050}
              className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
          <div className="p-8 md:p-10">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-wit-blue">
              <IconMision size={18} />
              Misión
            </span>
            <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-wit-ink">
              Nuestra <span className="text-wit-blue">Misión</span>
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-wit-gray">
              Impulsar el crecimiento de empresas y emprendedores mediante estrategias inteligentes
              de branding, marketing, inteligencia artificial y tecnología, creando soluciones que
              generen <strong className="text-wit-blue">valor</strong>,{" "}
              <strong className="text-wit-blue">conexión</strong> y{" "}
              <strong className="text-wit-blue">resultados sostenibles</strong>.
            </p>
          </div>
        </article>

        <article className="group overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(5,13,40,0.08)]">
          <div className="overflow-hidden">
            <img
              src="/assets/city_vision.webp"
              alt="Camino azul ascendente hacia una ciudad futurista enmarcada por una flecha"
              width={1400}
              height={1050}
              className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
          <div className="p-8 md:p-10">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-wit-blue">
              <IconVision size={18} />
              Visión
            </span>
            <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-wit-ink">
              Nuestra <span className="text-wit-blue">Visión</span>
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-wit-gray">
              Convertirnos en la <strong className="text-wit-blue">comunidad</strong> de marketing e{" "}
              <strong className="text-wit-blue">innovación</strong> más influyente de habla hispana,
              reconocida por transformar ideas en <strong className="text-wit-blue">marcas extraordinarias</strong>{" "}
              y por desarrollar un ecosistema que impulse el crecimiento de miles de empresas
              alrededor del mundo.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ---------------- 9. MEMBRESÍA ---------------- */

const PRECIO_MENSUAL = 5999;
const PRECIO_ANUAL = 50000; // facturado una vez al año

const BENEFICIOS = [
  "Acceso completo a la comunidad WITERS",
  "Creatividades publicitarias generadas con inteligencia artificial",
  "10 solicitudes de diseño incluidas en tu membresía",
  "Panel personal para dar seguimiento a cada petición",
  "Resultados en alta resolución, listos para tus campañas",
  "Soporte y acompañamiento de estrategia de marca",
];

function Membresia() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const [plan, setPlan] = useState<"mensual" | "anual">("anual");
  const esAnual = plan === "anual";
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  const mesEquivalente = Math.round(PRECIO_ANUAL / 12);
  const ahorro = Math.round((1 - PRECIO_ANUAL / (PRECIO_MENSUAL * 12)) * 100);
  return (
    <section id="membresia" className="relative overflow-hidden bg-wit-navy py-20 md:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-24 opacity-[0.07]"
      >
        <WMark size={560} />
      </div>

      <div className="relative px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tighter text-white md:text-6xl">
            Únete a la comunidad
            <br />
            del <span className="wit-underline text-[#5c85ff]">ingenio</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            Una sola membresía. Todo el poder del <strong className="text-white">ingenio</strong>,
            la <strong className="text-white">estrategia</strong> y la{" "}
            <strong className="text-white">inteligencia artificial</strong> trabajando para tu
            marca.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_40px_120px_rgba(0,71,255,0.35)]">
          <div className="bg-wit-blue px-8 py-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                Membresía WITERS
              </p>
              <div className="flex rounded-full bg-white/15 p-1">
                <button
                  type="button"
                  onClick={() => setPlan("mensual")}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
                    esAnual ? "text-white/85" : "bg-white text-wit-blue"
                  }`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setPlan("anual")}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
                    esAnual ? "bg-white text-wit-blue" : "text-white/85"
                  }`}
                >
                  Anual
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-wit-mono text-5xl font-semibold leading-none md:text-6xl">
                {fmt(esAnual ? mesEquivalente : PRECIO_MENSUAL)}
              </span>
              <span className="pb-1 text-sm font-semibold text-white/85">MXN / mes</span>
              {esAnual ? (
                <span className="mb-0.5 rounded-full bg-white px-3 py-1 text-xs font-extrabold tracking-wide text-wit-blue">
                  AHORRA {ahorro}%
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-white/80">
              {esAnual
                ? `Facturado anualmente: ${fmt(PRECIO_ANUAL)} MXN al año. Acceso completo a la plataforma.`
                : "Facturación mes a mes. Acceso completo a la plataforma."}
            </p>
          </div>

          <ul className="space-y-4 px-8 py-8">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[15px] text-wit-ink">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="#0047FF"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                >
                  <path d="M3.5 10.5 8 15l8.5-9.5" />
                </svg>
                {b}
              </li>
            ))}
          </ul>

          <div className="px-8 pb-9">
            <Link
              to={signedIn ? "/checkout" : "/registro"}
              className="block w-full rounded-2xl bg-wit-navy px-6 py-4 text-center text-lg font-bold text-white transition-all duration-200 hover:bg-wit-blue active:scale-[0.99]"
            >
              Quiero mi membresía
            </Link>
            <p className="mt-3 text-center text-xs text-wit-gray">
              Pago con tarjeta de crédito o débito. Activación inmediata.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 10. FAQ ---------------- */

const FAQS = [
  {
    q: "¿Qué incluye la membresía?",
    a: "Acceso a la comunidad WITERS y a la plataforma de creatividades con IA: 10 solicitudes de diseño, panel personal de seguimiento, resultados descargables en alta resolución y acompañamiento de estrategia de marca.",
  },
  {
    q: "¿Cómo se paga?",
    a: "Con tarjeta de crédito o débito desde la propia plataforma. Puedes elegir el plan mensual de $5,999 MXN al mes, o el plan anual de $50,000 MXN al año (equivalente a $4,167 al mes). Tu cuenta se activa de inmediato. Pronto también aceptaremos Mercado Pago.",
  },
  {
    q: "¿Cómo uso la plataforma?",
    a: "Crea tu cuenta, activa tu membresía y entra a tu panel. Ahí describes la imagen que necesitas (producto, estilo, formato), envías la solicitud y das seguimiento a su estado hasta descargar el resultado final.",
  },
  {
    q: "¿Qué tipo de imágenes puedo solicitar?",
    a: "Creatividades publicitarias para redes sociales, anuncios, banners, imágenes de producto y piezas de campaña. Cada solicitud se procesa con IA y con la supervisión del equipo WITERS.",
  },
];

function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section className="relative bg-white py-20 md:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-center text-3xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
          Preguntas <span className="wit-underline text-wit-blue">frecuentes</span>
        </h2>
        <div className="mt-10 divide-y divide-wit-ink/10 border-y border-wit-ink/10">
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  aria-expanded={open}
                >
                  <span className="text-base font-semibold text-wit-ink">{f.q}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    stroke="#0047FF"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    className={`shrink-0 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
                  >
                    <path d="M8 2v12M2 8h12" />
                  </svg>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 text-[15px] leading-relaxed text-wit-gray">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

