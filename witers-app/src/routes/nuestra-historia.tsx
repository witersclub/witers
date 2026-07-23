import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { useLanguage } from "../lib/i18n";
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

export const Route = createFileRoute("/nuestra-historia")({
  head: () => ({
    meta: [
      { title: "Nuestra historia. WITERS" },
      {
        name: "description",
        content:
          "Quiénes somos, nuestra filosofía, valores, propósito, historia, manifiesto, misión y visión en WITERS.",
      },
    ],
  }),
  component: NuestraHistoria,
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

function NuestraHistoria() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />
      <QuienesSomos />
      <Filosofia />
      <Valores />
      <Proposito />
      <Historia />
      <Manifiesto />
      <MisionVision />
      <SiteFooter />
    </div>
  );
}

/* ---------------- 1. QUIÉNES SOMOS ---------------- */

const PILLARS = [
  {
    icon: IconEstrategia,
    es: (
      <>
        En <strong className="text-wit-blue">WITERS</strong> reunimos branding, marketing,
        inteligencia artificial y tecnología para ayudar a empresas y emprendedores a construir
        marcas con propósito, crecer de manera inteligente y alcanzar su máximo potencial.
      </>
    ),
    en: (
      <>
        At <strong className="text-wit-blue">WITERS</strong> we bring together branding, marketing,
        artificial intelligence and technology to help companies and entrepreneurs build brands with
        purpose, grow intelligently and reach their full potential.
      </>
    ),
  },
  {
    icon: IconIngenio,
    es: (
      <>
        Más que ofrecer servicios, creamos experiencias, herramientas y soluciones que facilitan el
        crecimiento de nuestra comunidad. Cada estrategia y cada diseño nace con un mismo objetivo:
        transformar grandes ideas en{" "}
        <strong className="text-wit-blue">resultados extraordinarios</strong>.
      </>
    ),
    en: (
      <>
        Rather than simply offering services, we build experiences, tools and solutions that power
        our community&apos;s growth. Every strategy and every design is born with the same goal:
        turning great ideas into <strong className="text-wit-blue">extraordinary results</strong>.
      </>
    ),
  },
  {
    icon: IconCerebro,
    es: (
      <>
        Creemos que el conocimiento compartido genera{" "}
        <strong className="text-wit-blue">oportunidades</strong>, que la creatividad encuentra su
        mayor valor respaldada por la <strong className="text-wit-blue">estrategia</strong> y que la
        innovación cobra sentido cuando produce un{" "}
        <strong className="text-wit-blue">impacto real</strong>.
      </>
    ),
    en: (
      <>
        We believe shared knowledge creates <strong className="text-wit-blue">opportunities</strong>
        , that creativity finds its greatest value when backed by{" "}
        <strong className="text-wit-blue">strategy</strong>, and that innovation truly matters when
        it delivers <strong className="text-wit-blue">real impact</strong>.
      </>
    ),
  },
];

function QuienesSomos() {
  const { t, lang } = useLanguage();
  return (
    <section id="quienes-somos" className="relative bg-white pb-20 pt-32 md:pb-28 md:pt-40">
      <div className="px-5 md:px-[110px]">
        <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink md:text-6xl">
          {t("¿Quiénes ", "Who ")}
          <span className="wit-underline text-wit-blue">{t("Somos?", "We Are")}</span>
        </h1>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {PILLARS.map((p, i) => (
            <article key={i} className={i > 0 ? "md:border-l md:border-wit-ink/10 md:pl-8" : ""}>
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                <p.icon size={30} />
              </span>
              <p className="mt-5 text-[15px] leading-relaxed text-wit-gray">
                {lang === "en" ? p.en : p.es}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start gap-5 border-t border-wit-ink/10 pt-10 md:flex-row md:items-center">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
            <IconCrecimiento size={26} />
          </span>
          <p className="max-w-3xl text-lg leading-relaxed text-wit-ink">
            {lang === "en" ? (
              <>
                Being part of <strong className="text-wit-blue">WITERS</strong> means joining a
                community that is constantly evolving, where{" "}
                <strong className="text-wit-blue">ingenuity</strong> becomes{" "}
                <strong className="text-wit-blue">action</strong> and growth is a{" "}
                <strong className="text-wit-blue">shared experience</strong>.
              </>
            ) : (
              <>
                Ser parte de <strong className="text-wit-blue">WITERS</strong> significa formar
                parte de una comunidad que evoluciona constantemente, donde el{" "}
                <strong className="text-wit-blue">ingenio</strong> se convierte en{" "}
                <strong className="text-wit-blue">acción</strong> y el crecimiento es una{" "}
                <strong className="text-wit-blue">experiencia compartida</strong>.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 2. FILOSOFÍA ---------------- */

const FILO_PILLS = [
  { icon: IconIngenio, es: "Ingenio", en: "Ingenuity" },
  { icon: IconEstrategia, es: "Estrategia", en: "Strategy" },
  { icon: IconExcelencia, es: "Creatividad", en: "Creativity" },
  { icon: IconEvolucion, es: "Evolución", en: "Evolution" },
];

function Filosofia() {
  const imgRef = useParallax(0.05);
  const { t } = useLanguage();
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="grid items-center gap-12 px-5 md:grid-cols-[0.95fr_1.05fr] md:px-[110px]">
        <div className="order-2 md:order-1">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">
            {t("Nuestra", "Our")}
          </p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-blue md:text-6xl">
            {t("Filosofía", "Philosophy")}
          </h2>
          <p className="mt-8 max-w-md text-2xl font-semibold leading-snug text-wit-ink">
            {t("Creemos que el ", "We believe ")}
            <span className="text-wit-blue">{t("ingenio", "ingenuity")}</span>
            {t(" es el motor que impulsa la ", " is the engine that drives ")}
            <span className="text-wit-blue">{t("evolución", "evolution")}</span>.
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-wit-gray">
            {t(
              "Cada idea tiene el potencial de convertirse en una gran oportunidad cuando encuentra la ",
              "Every idea has the potential to become a great opportunity when it finds the right ",
            )}
            <strong className="text-wit-ink">{t("estrategia", "strategy")}</strong>
            {t(" adecuada, la ", ", the right ")}
            <strong className="text-wit-ink">{t("creatividad", "creativity")}</strong>
            {t(" correcta y las ", " and the ")}
            <strong className="text-wit-ink">{t("herramientas", "tools")}</strong>
            {t(" para desarrollarse.", " it needs to grow.")}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {FILO_PILLS.map((p) => (
              <span
                key={p.es}
                className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-white px-4 py-2 text-sm font-semibold text-wit-blue"
              >
                <p.icon size={18} />
                {t(p.es, p.en)}
              </span>
            ))}
          </div>
        </div>
        <div ref={imgRef} className="order-1 will-change-transform md:order-2">
          <img
            src="/assets/sphere.webp"
            alt={t(
              "Esfera de partículas azul brillando sobre un podio blanco",
              "Blue particle sphere glowing above a white podium",
            )}
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

/* ---------------- 3. VALORES ---------------- */

const VALORES = [
  {
    icon: IconIngenio,
    label: { es: "Ingenio", en: "Ingenuity" },
    text: {
      es: "Encontramos oportunidades donde otros ven desafíos y convertimos las ideas en soluciones inteligentes.",
      en: "We find opportunities where others see challenges, turning ideas into smart solutions.",
    },
    angle: -90,
  },
  {
    icon: IconInnovacion,
    label: { es: "Innovación", en: "Innovation" },
    text: {
      es: "Exploramos nuevas formas de crear, aprender y evolucionar constantemente.",
      en: "We constantly explore new ways to create, learn and evolve.",
    },
    angle: -30,
  },
  {
    icon: IconEstrategia,
    label: { es: "Estrategia", en: "Strategy" },
    text: {
      es: "Cada decisión responde a un propósito y cada acción acerca a nuestros clientes a sus objetivos.",
      en: "Every decision serves a purpose, and every action brings our clients closer to their goals.",
    },
    angle: 30,
  },
  {
    icon: IconExcelencia,
    label: { es: "Excelencia", en: "Excellence" },
    text: {
      es: "Cuidamos cada detalle para ofrecer experiencias, servicios y resultados de la más alta calidad.",
      en: "We look after every detail to deliver experiences, services and results of the highest quality.",
    },
    angle: 90,
  },
  {
    icon: IconColaboracion,
    label: { es: "Colaboración", en: "Collaboration" },
    text: {
      es: "Creemos en el poder de construir, compartir y crecer juntos como comunidad.",
      en: "We believe in the power of building, sharing and growing together as a community.",
    },
    angle: 150,
  },
  {
    icon: IconEvolucion,
    label: { es: "Evolución", en: "Evolution" },
    text: {
      es: "El crecimiento continuo forma parte de nuestra esencia. Siempre existe un siguiente nivel por alcanzar.",
      en: "Continuous growth is part of who we are. There is always a next level to reach.",
    },
    angle: 210,
  },
];

function Valores() {
  const { t } = useLanguage();
  return (
    <section id="valores" className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="grid items-start gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">
              {t("Nuestros", "Our")}
            </p>
            <h2 className="wit-underline mt-1 text-5xl font-extrabold tracking-tighter text-wit-ink md:text-6xl">
              {t("Valores", "Values")}
            </h2>
            <p className="mt-8 max-w-sm text-lg leading-relaxed text-wit-gray">
              {t(
                "Nuestros valores son el núcleo que guía cada decisión, cada estrategia y cada relación que construimos.",
                "Our values are the core that guides every decision, every strategy and every relationship we build.",
              )}
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
                    key={v.label.es}
                    className="group absolute w-40 -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-wit-blue shadow-[0_10px_30px_rgba(5,13,40,0.12)] transition-transform duration-200 group-hover:scale-110">
                      <v.icon size={28} />
                    </span>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-wit-blue">
                      {t(v.label.es, v.label.en)}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-wit-gray">
                      {t(v.text.es, v.text.en)}
                    </p>
                  </div>
                );
              })}
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:hidden">
              {VALORES.map((v) => (
                <li key={v.label.es} className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                    <v.icon size={24} />
                  </span>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-wit-blue">
                      {t(v.label.es, v.label.en)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-wit-gray">
                      {t(v.text.es, v.text.en)}
                    </p>
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

/* ---------------- 4. PROPÓSITO ---------------- */

function Proposito() {
  const { t, lang } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-24">
      <div className="grid items-center gap-10 px-5 md:grid-cols-2 md:px-[110px]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-wit-mist/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-wit-blue">
            <IconProposito size={16} />
            {t("Propósito", "Purpose")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Nuestro ", "Our ")}
            <span className="wit-underline text-wit-blue">{t("Propósito", "Purpose")}</span>
          </h2>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-wit-gray">
            {lang === "en" ? (
              <>
                <strong className="text-wit-blue">Inspire</strong> and{" "}
                <strong className="text-wit-blue">empower</strong> people, entrepreneurs and
                companies to discover the value of their ideas and turn them into projects capable
                of generating <strong className="text-wit-ink">impact</strong>,{" "}
                <strong className="text-wit-ink">growth</strong> and{" "}
                <strong className="text-wit-ink">legacy</strong>.
              </>
            ) : (
              <>
                <strong className="text-wit-blue">Inspirar</strong> y{" "}
                <strong className="text-wit-blue">potenciar</strong> a personas, emprendedores y
                empresas para que descubran el valor de sus ideas y las conviertan en proyectos
                capaces de generar <strong className="text-wit-ink">impacto</strong>,{" "}
                <strong className="text-wit-ink">crecimiento</strong> y{" "}
                <strong className="text-wit-ink">legado</strong>.
              </>
            )}
          </p>
        </div>
        <img
          src="/assets/mountain.webp"
          alt={t(
            "Montaña low-poly blanca con bandera azul en la cima y camino de luz",
            "White low-poly mountain with a blue flag at the summit and a path of light",
          )}
          width={1400}
          height={1400}
          className="mx-auto w-full max-w-md"
          loading="lazy"
        />
      </div>
    </section>
  );
}

/* ---------------- 5. HISTORIA ---------------- */

const HISTORIA = [
  {
    icon: IconIngenio,
    es: (
      <>
        Toda gran transformación comienza con una idea. Pero detrás de cada idea capaz de cambiar
        una empresa, una marca o una industria, existe un elemento indispensable:{" "}
        <strong className="text-wit-blue">el ingenio</strong>.
      </>
    ),
    en: (
      <>
        Every great transformation begins with an idea. But behind every idea capable of changing a
        company, a brand or an industry, there is one indispensable element:{" "}
        <strong className="text-wit-blue">ingenuity</strong>.
      </>
    ),
  },
  {
    word: "Wit",
    es: (
      <>
        La palabra <strong className="text-wit-blue">Wit</strong>, en inglés, representa la agilidad
        mental, la creatividad y la capacidad de encontrar soluciones que generan impacto. Ese
        concepto fue la inspiración para crear <strong className="text-wit-blue">WITERS</strong>.
      </>
    ),
    en: (
      <>
        The word <strong className="text-wit-blue">Wit</strong> represents mental agility,
        creativity and the ability to find solutions that create impact. That concept was the
        inspiration behind <strong className="text-wit-blue">WITERS</strong>.
      </>
    ),
  },
  {
    icon: IconComunidad,
    es: (
      <>
        Sin embargo, <strong className="text-wit-blue">WITERS</strong> es mucho más que un nombre.
        Es una filosofía. Una forma de pensar, crear y actuar. Un{" "}
        <strong className="text-wit-blue">Witer</strong> es quien transforma los desafíos en
        oportunidades, combina estrategia con creatividad y convierte las ideas en resultados.
      </>
    ),
    en: (
      <>
        But <strong className="text-wit-blue">WITERS</strong> is much more than a name. It&apos;s a
        philosophy. A way of thinking, creating and acting. A{" "}
        <strong className="text-wit-blue">Witer</strong> is someone who turns challenges into
        opportunities, pairs strategy with creativity, and turns ideas into results.
      </>
    ),
  },
  {
    icon: IconColaboracion,
    es: (
      <>
        Creemos que el ingenio es el recurso más poderoso para impulsar el crecimiento. Por eso
        decidimos evolucionar el concepto tradicional de una agencia de marketing y construir una{" "}
        <strong className="text-wit-blue">comunidad</strong> donde empresas, emprendedores,
        creadores y profesionales encuentran las herramientas, el conocimiento y las estrategias
        necesarias para crecer juntos.
      </>
    ),
    en: (
      <>
        We believe ingenuity is the most powerful resource for driving growth. That&apos;s why we
        decided to evolve beyond the traditional marketing agency and build a{" "}
        <strong className="text-wit-blue">community</strong> where companies, entrepreneurs,
        creators and professionals find the tools, knowledge and strategies they need to grow
        together.
      </>
    ),
  },
  {
    icon: IconEvolucion,
    es: (
      <>
        Nuestro símbolo representa esa visión. La flecha integrada en la W simboliza el{" "}
        <strong className="text-wit-blue">movimiento</strong>, la{" "}
        <strong className="text-wit-blue">evolución constante</strong> y la determinación de avanzar
        siempre hacia el <strong className="text-wit-blue">siguiente nivel</strong>. Es un
        recordatorio de que el crecimiento nunca se detiene y de que cada paso impulsa el siguiente.
      </>
    ),
    en: (
      <>
        Our symbol represents that vision. The arrow built into the W stands for{" "}
        <strong className="text-wit-blue">movement</strong>,{" "}
        <strong className="text-wit-blue">constant evolution</strong> and the determination to
        always move toward the <strong className="text-wit-blue">next level</strong>. It&apos;s a
        reminder that growth never stops and that every step fuels the next.
      </>
    ),
  },
  {
    icon: IconExcelencia,
    es: (
      <>
        En <strong className="text-wit-blue">WITERS</strong> no solo desarrollamos marcas.
        Construimos una comunidad donde el ingenio conecta personas, impulsa negocios y transforma
        ideas en proyectos extraordinarios.
      </>
    ),
    en: (
      <>
        At <strong className="text-wit-blue">WITERS</strong> we don&apos;t just build brands. We
        build a community where ingenuity connects people, drives businesses and turns ideas into
        extraordinary projects.
      </>
    ),
  },
];

function Historia() {
  const { t, lang } = useLanguage();
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="lg:sticky lg:top-28">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-ink">
                {t("Nuestra", "Our")}
              </p>
              <h2 className="wit-underline mt-1 text-5xl font-extrabold tracking-tighter text-wit-blue md:text-6xl">
                {t("Historia", "Story")}
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
                  <p className="text-[15px] leading-relaxed text-wit-gray">
                    {lang === "en" ? h.en : h.es}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 6. MANIFIESTO ---------------- */

const CREEMOS_A = [
  {
    es: "CREEMOS en el poder de las ideas que se atreven a ser diferentes.",
    en: "WE BELIEVE in the power of ideas that dare to be different.",
  },
  {
    es: "CREEMOS que la estrategia convierte la creatividad en resultados.",
    en: "WE BELIEVE strategy turns creativity into results.",
  },
  {
    es: "CREEMOS que la tecnología existe para multiplicar el talento humano.",
    en: "WE BELIEVE technology exists to multiply human talent.",
  },
  {
    es: "CREEMOS que compartir conocimiento nos hace más fuertes.",
    en: "WE BELIEVE sharing knowledge makes us stronger.",
  },
];
const CREEMOS_B = [
  {
    es: "CREEMOS que cada marca tiene una historia que merece ser contada.",
    en: "WE BELIEVE every brand has a story worth telling.",
  },
  {
    es: "CREEMOS que el crecimiento es un camino que se recorre en comunidad.",
    en: "WE BELIEVE growth is a journey best traveled together.",
  },
  {
    es: "CREEMOS que la excelencia está en los detalles.",
    en: "WE BELIEVE excellence lives in the details.",
  },
  {
    es: "CREEMOS que el ingenio es la idea que impulsa el cambio.",
    en: "WE BELIEVE ingenuity is the idea that drives change.",
  },
];

function Manifiesto() {
  const { t } = useLanguage();
  const prefix = t("CREEMOS", "WE BELIEVE");
  return (
    <section className="relative overflow-hidden bg-wit-navy py-20 text-white md:py-28">
      <div className="px-5 md:px-[110px]">
        <h2 className="text-4xl font-extrabold tracking-tighter md:text-5xl">
          {t("Nuestro ", "Our ")}
          <span className="wit-underline text-[#5c85ff]">{t("Manifiesto", "Manifesto")}</span>
        </h2>

        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {[CREEMOS_A, CREEMOS_B].map((col, ci) => (
              <ul key={ci} className="space-y-5">
                {col.map((c) => {
                  const full = t(c.es, c.en);
                  return (
                    <li key={c.es} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                      <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-wit-blue brightness-150" />
                      <span>
                        <strong className="font-extrabold text-white">{prefix}</strong>
                        {full.replace(prefix, "")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>

          <figure className="overflow-hidden rounded-3xl">
            <img
              src="/assets/corridor.webp"
              alt={t(
                "Persona caminando por un corredor de luz hacia el logotipo W",
                "Person walking through a corridor of light toward the W logo",
              )}
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

/* ---------------- 7. MISIÓN / VISIÓN ---------------- */

function MisionVision() {
  const { t, lang } = useLanguage();
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="grid gap-8 px-5 lg:grid-cols-2 md:px-[110px]">
        <article className="group overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(5,13,40,0.08)]">
          <div className="overflow-hidden">
            <img
              src="/assets/stairs_mission.webp"
              alt={t(
                "Escalera blanca ascendiendo hacia una puerta en forma de flecha azul",
                "White staircase rising toward a blue arrow-shaped doorway",
              )}
              width={1400}
              height={1050}
              className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
          <div className="p-8 md:p-10">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-wit-blue">
              <IconMision size={18} />
              {t("Misión", "Mission")}
            </span>
            <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-wit-ink">
              {t("Nuestra ", "Our ")}
              <span className="text-wit-blue">{t("Misión", "Mission")}</span>
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-wit-gray">
              {lang === "en" ? (
                <>
                  Drive the growth of companies and entrepreneurs through intelligent branding,
                  marketing, artificial intelligence and technology strategies, creating solutions
                  that generate <strong className="text-wit-blue">value</strong>,{" "}
                  <strong className="text-wit-blue">connection</strong> and{" "}
                  <strong className="text-wit-blue">sustainable results</strong>.
                </>
              ) : (
                <>
                  Impulsar el crecimiento de empresas y emprendedores mediante estrategias
                  inteligentes de branding, marketing, inteligencia artificial y tecnología, creando
                  soluciones que generen <strong className="text-wit-blue">valor</strong>,{" "}
                  <strong className="text-wit-blue">conexión</strong> y{" "}
                  <strong className="text-wit-blue">resultados sostenibles</strong>.
                </>
              )}
            </p>
          </div>
        </article>

        <article className="group overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(5,13,40,0.08)]">
          <div className="overflow-hidden">
            <img
              src="/assets/city_vision.webp"
              alt={t(
                "Camino azul ascendente hacia una ciudad futurista enmarcada por una flecha",
                "Blue path rising toward a futuristic city framed by an arrow",
              )}
              width={1400}
              height={1050}
              className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
          <div className="p-8 md:p-10">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-wit-blue">
              <IconVision size={18} />
              {t("Visión", "Vision")}
            </span>
            <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-wit-ink">
              {t("Nuestra ", "Our ")}
              <span className="text-wit-blue">{t("Visión", "Vision")}</span>
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-wit-gray">
              {lang === "en" ? (
                <>
                  Become the most influential Spanish-speaking marketing and{" "}
                  <strong className="text-wit-blue">innovation</strong>{" "}
                  <strong className="text-wit-blue">community</strong>, recognized for turning ideas
                  into <strong className="text-wit-blue">extraordinary brands</strong> and for
                  building an ecosystem that drives the growth of thousands of companies around the
                  world.
                </>
              ) : (
                <>
                  Convertirnos en la <strong className="text-wit-blue">comunidad</strong> de
                  marketing e <strong className="text-wit-blue">innovación</strong> más influyente
                  de habla hispana, reconocida por transformar ideas en{" "}
                  <strong className="text-wit-blue">marcas extraordinarias</strong> y por
                  desarrollar un ecosistema que impulse el crecimiento de miles de empresas
                  alrededor del mundo.
                </>
              )}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
