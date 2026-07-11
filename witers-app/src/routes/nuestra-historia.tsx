import { createFileRoute } from "@tanstack/react-router";
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
    <section id="quienes-somos" className="relative bg-white pb-20 pt-32 md:pb-28 md:pt-40">
      <div className="px-5 md:px-[110px]">
        <h1 className="text-4xl font-extrabold tracking-tighter text-wit-ink md:text-6xl">
          ¿Quiénes <span className="wit-underline text-wit-blue">Somos?</span>
        </h1>

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

/* ---------------- 2. FILOSOFÍA ---------------- */

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

/* ---------------- 3. VALORES ---------------- */

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

/* ---------------- 4. PROPÓSITO ---------------- */

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

/* ---------------- 5. HISTORIA ---------------- */

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

/* ---------------- 6. MANIFIESTO ---------------- */

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

/* ---------------- 7. MISIÓN / VISIÓN ---------------- */

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
