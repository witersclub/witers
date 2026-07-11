import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { WMark } from "../components/witers/brand";
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

function Landing() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <HeroVideoBackground />
      <SiteHeader />
      <Hero />
      <MarcasQueConfian />
      <LoQueHacemos />
      <TrabajosQueHablan />
      <Membresia />
      <Faq />
      <CtaFinal />
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
        poster="/assets/hero-banner.jpg"
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

// Real, finalized ("cerrada") client deliveries — same source and trust
// boundary as TrabajosQueHablan below (/api/public/showcase). Both call
// useQuery with the same queryKey, so React Query dedupes the fetch instead
// of hitting the endpoint twice.
type ShowcasePiece = { id: string; r2_key: string | null; image_url: string | null; title: string };

function useShowcase() {
  return useQuery({
    queryKey: ["public-showcase"],
    queryFn: async () => {
      const res = await fetch("/api/public/showcase");
      if (!res.ok) return { ok: false, pieces: [] as ShowcasePiece[] };
      return (await res.json()) as { ok: boolean; pieces: ShowcasePiece[] };
    },
    staleTime: 60_000,
  });
}

// Instagram-style auto-advancing carousel of real finished pieces, in the
// hero's portrait slot. Falls back to a branded placeholder card (not a
// stock photo) until the first "cerrada" request exists.
function HeroCarousel() {
  const showcase = useShowcase();
  const pieces = (showcase.data?.pieces ?? []).slice(0, 8);
  const slides = pieces.map((p) => ({
    key: p.id,
    src: p.image_url ?? `/api/public/showcase-image?key=${encodeURIComponent(p.r2_key ?? "")}`,
    alt: p.title,
  }));
  const hasReal = slides.length > 0;
  const count = hasReal ? slides.length : 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 3800);
    return () => clearInterval(t);
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  return (
    <div
      className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[32px] bg-wit-mist shadow-[0_30px_80px_rgba(5,13,40,0.18)] md:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {hasReal ? (
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * (100 / slides.length)}%)`, width: `${slides.length * 100}%` }}
        >
          {slides.map((s, i) => (
            <img
              key={s.key}
              src={s.src}
              alt={s.alt}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full shrink-0 object-cover"
              style={{ width: `${100 / slides.length}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="wit-glass flex h-full w-full flex-col items-center justify-center gap-4 rounded-[32px]">
          <WMark size={56} />
          <p className="max-w-[220px] text-center text-sm font-semibold text-wit-gray">
            Aquí verás las creatividades que entreguemos a nuestra comunidad
          </p>
        </div>
      )}

      {count > 1 ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent"
          />
          <div className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {index + 1}/{count}
          </div>
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Ver imagen ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Hero() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);

  return (
    <section className="relative overflow-hidden pb-14 pt-28 md:pb-20 md:pt-36">
      <div className="relative grid items-center gap-12 px-5 md:grid-cols-[1.05fr_0.95fr] md:px-[110px]">
        <div>
          <h1 className="wit-rise text-4xl font-extrabold leading-tight tracking-tighter text-wit-ink md:text-6xl">
            Elevemos tu marca.
            <br />
            <span className="wit-underline italic text-wit-blue">Con ingenio y tecnología.</span>
          </h1>
          <p className="wit-rise wit-rise-d1 mt-6 max-w-md text-lg leading-relaxed text-wit-gray">
            Estrategia, diseño y tecnología con inteligencia artificial para marcas que quieren{" "}
            <strong className="text-wit-ink">dejar huella</strong>.
          </p>
          <div className="wit-rise wit-rise-d2 mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              to={signedIn ? "/panel" : "/registro"}
              className="group inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-white shadow-[0_16px_36px_rgba(0,71,255,0.35)] transition-all duration-200 hover:shadow-[0_20px_44px_rgba(0,71,255,0.45)] active:scale-[0.98]"
            >
              Unirme ahora
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1">
                <path d="M3 13 13 3M13 3H6M13 3v7" />
              </svg>
            </Link>
            <a href="/nuestra-historia" className="wit-navlink text-sm font-semibold text-wit-ink">
              Conocer la comunidad
            </a>
          </div>
        </div>

        <div className="wit-rise wit-rise-d2 relative mx-auto w-full max-w-sm md:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(0,71,255,0.25),transparent)] blur-2xl"
          />
          <HeroCarousel />
          <img
            src="/assets/witers-logo-full.png"
            alt=""
            aria-hidden="true"
            className="wit-float absolute -right-6 -top-8 hidden h-24 w-auto drop-shadow-lg md:block"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1a. MARCAS QUE CONFÍAN ---------------- */

// Real client brands only — company_name + logo_key come straight from the
// client's own request intake form (panel.tsx), scoped server-side to
// finalized ("cerrada") requests. No stand-in/fabricated logos here: if a
// client hasn't given us a name + logo yet, their brand simply doesn't
// appear, and the whole section hides itself rather than show a placeholder.
type Brand = { company_name: string; logo_key: string };

function MarcasQueConfian() {
  const brands = useQuery({
    queryKey: ["public-brands"],
    queryFn: async () => {
      const res = await fetch("/api/public/brands");
      if (!res.ok) return { ok: false, brands: [] as Brand[] };
      return (await res.json()) as { ok: boolean; brands: Brand[] };
    },
    staleTime: 60_000,
  });

  const list = brands.data?.brands ?? [];
  if (list.length === 0) return null;

  return (
    <section className="relative bg-white pb-16 md:pb-20">
      <div className="px-5 md:px-[110px]">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-wit-ink/10 pt-10">
          <p className="text-xs font-bold uppercase leading-tight tracking-[0.22em] text-wit-gray">
            Marcas
            <br />
            que confían
          </p>
          {list.map((b) => (
            <img
              key={b.logo_key}
              src={`/api/public/brand-logo?key=${encodeURIComponent(b.logo_key)}`}
              alt={b.company_name}
              loading="lazy"
              className="h-8 w-auto max-w-[140px] object-contain opacity-70 grayscale transition duration-200 hover:opacity-100 hover:grayscale-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1a. LO QUE HACEMOS ---------------- */

// Placeholder AI-generated icon renders (Higgsfield), hosted on their CDN —
// a stand-in until WITERS supplies its own service iconography. Swap for
// self-hosted assets under /assets before this ships for real.
const SERVICIOS = [
  {
    img: "https://d8j0ntlcm91z4.cloudfront.net/user_3EXW5AO9RcMslsDHXSGxiyHt5iO/hf_20260711_034811_2724ee1b-9bd8-442d-95ca-0f6a4d828ef4.png",
    label: "Estrategia de marca",
  },
  {
    img: "https://d8j0ntlcm91z4.cloudfront.net/user_3EXW5AO9RcMslsDHXSGxiyHt5iO/hf_20260711_034811_4b7a6f0d-6ccf-4c96-8a81-751f9d083dd6.png",
    label: "Diseño con IA",
  },
  {
    img: "https://d8j0ntlcm91z4.cloudfront.net/user_3EXW5AO9RcMslsDHXSGxiyHt5iO/hf_20260711_034811_f0c41893-c6a2-4cda-9a42-3d376641d753.png",
    label: "Producción de contenido",
  },
  {
    img: "https://d8j0ntlcm91z4.cloudfront.net/user_3EXW5AO9RcMslsDHXSGxiyHt5iO/hf_20260711_034811_a57aefa9-df46-4788-906e-12d2c59ca804.png",
    label: "Comunidad y crecimiento",
  },
];

function LoQueHacemos() {
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-blue">Lo que hacemos</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
          Creamos experiencias que{" "}
          <span className="wit-underline italic text-wit-blue">conectan e impactan</span>.
        </h2>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICIOS.map((s) => (
            <article
              key={s.label}
              className="group rounded-3xl bg-wit-mist/40 p-6 transition-colors duration-200 hover:bg-wit-mist/70"
            >
              <img src={s.img} alt="" aria-hidden="true" className="h-28 w-28 object-contain" loading="lazy" />
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-base font-bold text-wit-ink">{s.label}</p>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="#0047FF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
                >
                  <path d="M3 13 13 3M13 3H6M13 3v7" />
                </svg>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1b. TRABAJOS QUE HABLAN ---------------- */

// Placeholder slots shown only until the first "cerrada" (finalized) client
// request exists.
const PIEZAS_EJEMPLO = [
  { label: "Post cuadrado", ratio: "1:1" },
  { label: "Historia", ratio: "9:16" },
  { label: "Banner", ratio: "16:9" },
  { label: "Post vertical", ratio: "3:4" },
];

type Card =
  | { key: string; kind: "real"; src: string; alt: string }
  | { key: string; kind: "placeholder"; label: string; ratio: string };

// Alternating tilt per card, like a fanned-out deck — matches the reference
// layout's stacked project mockups.
const TILTS = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6"];

function TrabajosQueHablan() {
  const showcase = useShowcase();

  const realPieces = showcase.data?.pieces ?? [];
  const cards: Card[] =
    realPieces.length > 0
      ? realPieces.slice(0, 4).map((p) => ({
          key: p.id,
          kind: "real",
          src: p.image_url ?? `/api/public/showcase-image?key=${encodeURIComponent(p.r2_key ?? "")}`,
          alt: p.title,
        }))
      : PIEZAS_EJEMPLO.map((p, i) => ({ key: `ph-${i}`, kind: "placeholder", label: p.label, ratio: p.ratio }));

  return (
    <section className="relative overflow-hidden bg-wit-navy py-20 text-white md:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/2 -translate-y-1/2 opacity-[0.06]"
      >
        <WMark size={620} />
      </div>

      <div className="relative grid items-center gap-14 px-5 md:grid-cols-[0.95fr_1.05fr] md:px-[110px]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#7d9aff]">Trabajos que hablan</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-5xl">
            No es solo diseño.
            <br />
            <span className="wit-underline italic text-[#7d9aff]">Es transformación.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-white/70">
            Cada proyecto que hacemos está pensado para generar resultados reales.
          </p>
          <a
            href="/nuestra-historia"
            className="wit-navlink mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Ver nuestros trabajos
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 13 13 3M13 3H6M13 3v7" />
            </svg>
          </a>
        </div>

        <div className="flex justify-center gap-[-2rem] md:justify-end">
          {cards.map((p, i) =>
            p.kind === "real" ? (
              <img
                key={p.key}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                style={{ marginLeft: i === 0 ? 0 : "-2.75rem", zIndex: i + 1 }}
                className={`${TILTS[i % TILTS.length]} h-64 w-44 shrink-0 rounded-2xl object-cover shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-transform duration-300 hover:z-10 hover:-translate-y-2 hover:rotate-0`}
              />
            ) : (
              <div
                key={p.key}
                style={{ marginLeft: i === 0 ? 0 : "-2.75rem", zIndex: i + 1 }}
                className={`${TILTS[i % TILTS.length]} wit-glass flex h-64 w-44 shrink-0 flex-col items-center justify-center gap-3 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-transform duration-300 hover:z-10 hover:-translate-y-2 hover:rotate-0`}
              >
                <WMark size={30} />
                <div className="text-center">
                  <p className="text-xs font-bold text-white">{p.label}</p>
                  <p className="text-[11px] text-white/60">{p.ratio}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1c. CTA FINAL ---------------- */

function CtaFinal() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  return (
    <section className="relative bg-white py-16 md:py-20">
      <div className="flex flex-col items-start gap-8 border-t border-wit-ink/10 px-5 pt-14 md:flex-row md:items-center md:justify-between md:px-[110px]">
        <h2 className="text-2xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
          Tu marca tiene algo único.
          <br />
          Hagamos que el mundo <span className="italic text-wit-blue">la vea</span>.
        </h2>
        <Link
          to={signedIn ? "/panel" : "/registro"}
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-wit-ink/15 bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.08)] transition-all duration-200 hover:bg-wit-ink hover:text-white active:scale-[0.98]"
        >
          Hablemos de tu proyecto
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1">
            <path d="M3 13 13 3M13 3H6M13 3v7" />
          </svg>
        </Link>
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

