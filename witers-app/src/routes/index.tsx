import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { WMark } from "../components/witers/brand";
import { MembershipComparisonTable } from "../components/witers/membership-comparison-table";
import { MembershipPlanCards } from "../components/witers/membership-cards";
import { MetaAdsDashboardCard, WhatsAppPhoneMockup } from "../components/witers/meta-ads-card";
import {
  AspectRatioPicker,
  ColorsPicker,
  PieceTypePicker,
  StylePicker,
} from "../components/witers/lab-pickers";
import { useDraggableMarquee } from "../hooks/use-draggable-marquee";
import { PROMO_MESES } from "../lib/membership-plans";
import { saveTeaserAnswers } from "../lib/teaser-handoff";
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
      <Testimonios />
      <MarcasQueConfian />
      <PruebaInteractiva />
      <CampanasTeaser />
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

// Real satisfaction-survey ratings/feedback, paired with the piece the
// client reviewed — see /api/public/reviews.ts for the trust boundary.
// Never fabricated: no stand-in people, photos, or quotes. Sections built
// from this hide themselves entirely when the list is empty rather than
// show a placeholder testimonial.
type Review = {
  request_id: string;
  rating: number;
  feedback: string | null;
  company_name: string | null;
  first_name: string;
  r2_key: string | null;
  image_url: string | null;
};

function useReviews() {
  return useQuery({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      const res = await fetch("/api/public/reviews");
      if (!res.ok) return { ok: false, reviews: [] as Review[] };
      return (await res.json()) as { ok: boolean; reviews: Review[] };
    },
    staleTime: 60_000,
  });
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const STAR_PATH =
    "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.539 1.118l-3.367-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.98 9.385c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z";
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 20 20">
          <path d={STAR_PATH} fill={n <= Math.round(rating) ? "#0047FF" : "#0047FF22"} />
        </svg>
      ))}
    </div>
  );
}

function Hero() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);

  return (
    <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
      <div className="relative mx-auto max-w-3xl px-5 text-center md:px-[110px]">
        <span className="wit-rise inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue backdrop-blur-sm">
          Branding · Marketing · IA
        </span>
        <h1 className="wit-rise wit-rise-d1 mx-auto mt-7 max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-7xl">
          Elevemos tu{" "}
          <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
            marca
          </span>
          .
        </h1>
        <p className="wit-rise wit-rise-d2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-wit-gray">
          Estrategia, diseño y tecnología para marcas que quieren dejar huella. Únete a la comunidad
          y empieza a crear hoy.
        </p>
        <div className="wit-rise wit-rise-d2 mt-9 flex flex-col items-center gap-5">
          <Link
            to={signedIn ? "/panel" : "/registro"}
            className="group inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-8 py-4 text-base font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
          >
            Unirme ahora
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
          <a href="/nuestra-historia" className="wit-navlink text-sm font-semibold text-wit-ink">
            Conocer la comunidad
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1a. RESULTADOS REALES (imagen + reseña) ---------------- */

function Testimonios() {
  const reviews = useReviews();
  const list = reviews.data?.reviews ?? [];

  const cards = list.map((r) => ({
    ...r,
    src: r.image_url ?? `/api/public/showcase-image?key=${encodeURIComponent(r.r2_key ?? "")}`,
  }));
  // Duplicated back to back so the track can loop seamlessly.
  const track = [...cards, ...cards.map((c) => ({ ...c, request_id: `${c.request_id}-2` }))];
  const { trackRef, dragHandlers } = useDraggableMarquee(track.length);

  // No fabricated testimonials — the whole section stays hidden until at
  // least one client has actually submitted a rating. Hooks above still run
  // every render either way, so this early return can't shift hook order.
  if (list.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-white/55 py-20 backdrop-blur-2xl md:py-28">
      <div className="px-5 md:px-[110px]">
        <p className="text-center text-sm font-bold uppercase tracking-[0.3em] text-wit-blue">
          Resultados reales
        </p>
        <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
          Lo que dicen quienes ya{" "}
          <span className="wit-underline italic text-wit-blue">confiaron en nosotros</span>.
        </h2>
      </div>

      <div className="wit-marquee-mask relative mt-14 overflow-hidden">
        <div
          ref={trackRef}
          {...dragHandlers}
          className="flex w-max cursor-grab touch-pan-y gap-6 px-5 active:cursor-grabbing"
        >
          {track.map((r) => (
            <article
              key={r.request_id}
              className="w-64 shrink-0 overflow-hidden rounded-[24px] bg-white shadow-[0_20px_60px_rgba(5,13,40,0.12)]"
            >
              <img src={r.src} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
              <div className="p-4">
                <Stars rating={r.rating} size={14} />
                {r.feedback ? (
                  <p className="mt-1.5 line-clamp-2 text-sm italic leading-snug text-wit-ink">
                    &ldquo;{r.feedback}&rdquo;
                  </p>
                ) : null}
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wit-blue text-xs font-bold text-white">
                    {r.first_name.slice(0, 1).toUpperCase()}
                  </span>
                  <p className="text-xs font-bold text-wit-ink">
                    {r.first_name}
                    {r.company_name ? (
                      <span className="font-normal text-wit-gray"> — {r.company_name}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            </article>
          ))}
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

// Splits the brand list round-robin across a fixed number of ticker slots
// (mobile view) — slot i gets brands[i], brands[i+slotCount], ... — so each
// slot cycles through roughly its own share instead of all slots repeating
// the same sequence.
function buildTickerSlots(list: Brand[], slotCount: number): Brand[][] {
  const slots: Brand[][] = Array.from({ length: slotCount }, () => []);
  list.forEach((b, i) => slots[i % slotCount].push(b));
  return slots;
}

// A logo repeated this many times lets the ticker just keep counting
// forward through a long, flattened copy of its slot's list instead of
// ever needing to loop back to index 0 — which would either snap
// backwards or need a fake reset-without-transition trick. At one flip
// every 2.6s this covers well over two minutes of continuous display,
// far longer than this decorative bar is realistically left open for.
const TICKER_REPEATS = 60;
const TICKER_INTERVAL_MS = 2600;
// Must match the h-14 class on both the slot and each stacked logo below —
// kept as a plain px constant (not a CSS %) because the inner column's own
// height is TICKER_REPEATS times taller than one slot, so a `translateY`
// percentage would be relative to that whole stack (thousands of px), not
// to a single logo step.
const TICKER_SLOT_HEIGHT_PX = 56;

// One vertical "ticker" slot for the mobile trust bar — a fixed-height,
// overflow-hidden window holding a tall column of stacked logos; sliding
// that column up by one logo-height at a time is what makes the current
// logo look like it slides away upward as the next one slides up into its
// place. `offsetMs` staggers each slot's first flip so the three don't all
// turn over in lockstep.
function BrandTickerSlot({ brands, offsetMs }: { brands: Brand[]; offsetMs: number }) {
  const [index, setIndex] = useState(0);
  const items =
    brands.length > 1 ? Array.from({ length: TICKER_REPEATS }, () => brands).flat() : brands;

  useEffect(() => {
    if (brands.length <= 1) return;
    let interval: number | undefined;
    const kickoff = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, items.length - 1));
      interval = window.setInterval(() => {
        setIndex((i) => Math.min(i + 1, items.length - 1));
      }, TICKER_INTERVAL_MS);
    }, offsetMs);
    return () => {
      window.clearTimeout(kickoff);
      if (interval) window.clearInterval(interval);
    };
    // items.length is derived from brands and stable for the slot's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands.length, offsetMs]);

  if (brands.length === 0) return null;

  return (
    <div className="h-14 w-24 shrink-0 overflow-hidden">
      <div
        className="transition-transform duration-700 ease-in-out"
        style={{ transform: `translateY(-${index * TICKER_SLOT_HEIGHT_PX}px)` }}
      >
        {items.map((b, i) => (
          <img
            key={i}
            src={`/api/public/brand-logo?key=${encodeURIComponent(b.logo_key)}`}
            alt={b.company_name}
            loading="lazy"
            className="h-14 w-24 object-contain grayscale"
          />
        ))}
      </div>
    </div>
  );
}

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

  const slots = buildTickerSlots(list, Math.min(3, list.length));

  return (
    <section className="relative bg-white py-16 md:py-20">
      <div className="px-5 md:px-[110px]">
        <p className="text-center text-base text-wit-gray">
          Marcas que ya confían en <strong className="text-wit-ink">WITERS</strong>
        </p>

        {/* Desktop/tablet: every brand, always a single straight row — never
            wraps to a second line. overflow-x-auto is just a safety net for
            a long list on a narrower desktop width, not the intended look. */}
        <div className="mt-10 hidden flex-nowrap items-center justify-center gap-x-14 overflow-x-auto md:flex">
          {list.map((b) => (
            <img
              key={b.logo_key}
              src={`/api/public/brand-logo?key=${encodeURIComponent(b.logo_key)}`}
              alt={b.company_name}
              loading="lazy"
              className="h-14 w-auto max-w-[180px] shrink-0 object-contain grayscale"
            />
          ))}
        </div>

        {/* Mobile: only 3 logos on screen at once, large, each cycling
            through its share of the rest via the vertical ticker above. */}
        <div className="mt-10 flex items-center justify-center gap-8 md:hidden">
          {slots.map((slotBrands, i) => (
            <BrandTickerSlot key={i} brands={slotBrands} offsetMs={i * 900} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 1b. PRUEBA INTERACTIVA ---------------- */

// A trimmed, public preview of the AI-lab intake chat (admin-lab.tsx) —
// only the four zero-typing, zero-file, zero-AI-call pickers (piece type,
// format, colors, style). Nothing here ever calls OpenAI or touches
// design_requests, so it costs nothing to run for an anonymous visitor no
// matter how many times they play with it. The payoff at the end is the
// account/checkout flow, not a generated image — that stays behind
// signup, where a real client relationship (and the membership that pays
// for actual generation) already exists.
const PRUEBA_STEPS = [
  { field: "pieceType", text: "¿Qué tipo de pieza quieres crear hoy?" },
  { field: "aspectRatio", text: "¿Qué forma tiene la pieza que te imaginas?" },
  { field: "colors", text: "¿Tienes colores de marca? Si no, elige los que más te gusten." },
  { field: "style", text: "¿Qué estilo visual te gustaría?" },
] as const;

function PruebaInteractiva() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const done = step >= PRUEBA_STEPS.length;

  function submitAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [PRUEBA_STEPS[step].field]: value }));
    setStep((s) => s + 1);
  }

  const current = PRUEBA_STEPS[step];
  const activeInput =
    current?.field === "pieceType" ? (
      <PieceTypePicker onPick={submitAnswer} />
    ) : current?.field === "aspectRatio" ? (
      <AspectRatioPicker onPick={submitAnswer} />
    ) : current?.field === "colors" ? (
      <ColorsPicker onPick={submitAnswer} />
    ) : current?.field === "style" ? (
      <StylePicker onPick={submitAnswer} />
    ) : null;

  return (
    <section className="relative overflow-hidden bg-white/55 py-16 backdrop-blur-2xl md:py-20">
      <div className="mx-auto max-w-sm px-5">
        <p className="wit-rise text-center text-xs font-bold uppercase tracking-[0.14em] text-wit-blue">
          Pruébalo tú mismo
        </p>
        <h2 className="wit-rise mt-2 text-center text-2xl font-extrabold tracking-tighter text-wit-ink md:text-3xl">
          Arma tu pieza en 4 pasos
        </h2>

        <div className="wit-glass mt-8 rounded-3xl p-6 shadow-[0_20px_50px_rgba(5,13,40,0.08)]">
          {!started ? (
            <div className="flex flex-col items-center gap-6 py-4 text-center">
              <div className="wit-float">
                <WMark size={34} />
              </div>
              <p className="max-w-xs text-sm text-wit-gray">
                Cuéntanos qué quieres crear hoy y armamos tu pieza juntos.
              </p>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
              >
                ✨ Habla con Wit ✨
              </button>
            </div>
          ) : !done ? (
            <>
              <div className="mb-5 flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
                  <WMark size={13} />
                </span>
                <p className="rounded-2xl rounded-bl-sm bg-wit-mist/50 px-4 py-2.5 text-sm text-wit-ink">
                  {current.text}
                </p>
              </div>
              {activeInput}
              <div className="mx-auto mt-6 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-wit-mist/50">
                <div
                  className="h-full rounded-full bg-wit-blue transition-all duration-500 ease-out"
                  style={{ width: `${(step / PRUEBA_STEPS.length) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="wit-float">
                <WMark size={30} />
              </div>
              <p className="text-base font-bold text-wit-ink">¡Nos encantó lo que armaste!</p>
              <p className="text-sm text-wit-gray">
                Crea tu cuenta para que empecemos a diseñar tu pieza de verdad.
              </p>
              <div className="mt-2 flex w-full flex-col gap-2">
                <Link
                  to="/registro"
                  onClick={() => saveTeaserAnswers(answers)}
                  className="rounded-full bg-wit-blue px-6 py-3 text-center text-sm font-bold text-white hover:bg-wit-blue-deep"
                >
                  Crear cuenta gratis
                </Link>
                <Link
                  to="/ingresar"
                  onClick={() => saveTeaserAnswers(answers)}
                  className="rounded-full border border-wit-ink/15 px-6 py-3 text-center text-sm font-bold text-wit-ink hover:bg-wit-mist/40"
                >
                  Ya tengo cuenta
                </Link>
              </div>
            </div>
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

/* ---------------- 9. MEMBRESÍA ---------------- */

function Membresia() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
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
          <span className="inline-flex items-center gap-2 rounded-full border border-[#5c85ff]/40 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-[#9db4ff]">
            Promoción Julio 2026 · Para nuevos suscriptores
          </span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tighter text-white md:text-6xl">
            Únete a la comunidad
            <br />
            del <span className="wit-underline text-[#5c85ff]">ingenio</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            Elige el nivel de acompañamiento que tu marca necesita. Todo el poder del{" "}
            <strong className="text-white">ingenio</strong>, la{" "}
            <strong className="text-white">estrategia</strong> y la{" "}
            <strong className="text-white">inteligencia artificial</strong> trabajando para ti.
          </p>
        </div>

        <MembershipPlanCards
          ctaFor={(m) => ({
            to: signedIn ? "/checkout" : "/registro",
            search: { plan: m.id },
            label: `Quiero ${m.nombre}`,
          })}
        />
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-white/50">
          Pago con tarjeta de crédito o débito. Activación inmediata. Suscripción con renovación
          automática mensual — puedes cancelar cuando quieras.{" "}
          <Link to="/terminos" className="underline hover:text-white">
            Ver términos y condiciones
          </Link>
          .
        </p>

        <MembershipComparisonTable />
      </div>
    </section>
  );
}

/* ---------------- 9b. CAMPAÑAS TEASER ---------------- */

function CampanasTeaser() {
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-5 text-center md:px-[110px]">
        <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-5xl">
          De la pieza a la{" "}
          <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
            campaña
          </span>
          .
        </h2>
      </div>

      <div className="mt-14 grid items-center gap-14 px-5 md:px-[110px] lg:grid-cols-2">
        <div className="relative pb-8 pl-8 pt-4 sm:pb-14 sm:pl-16">
          <MetaAdsDashboardCard />
          <WhatsAppPhoneMockup className="absolute -bottom-6 -left-2 z-10 sm:-bottom-10 sm:-left-6" />
        </div>

        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-wit-mist/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue">
            Meta Ads
          </span>
          <h3 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-5xl">
            Tu pieza no se queda
            <br />
            en <span className="italic text-wit-blue">"me gusta"</span>.
          </h3>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-wit-gray">
            El equipo de WITERS se encarga de que tenga el mayor alcance para tus ventas — la
            convertimos en una campaña real de Meta Ads, configurada, medible y lista para vender.
            Sin salir de WITERS.
          </p>
          <Link
            to="/pauta"
            className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
          >
            Quiero campañas
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
        </div>
      </div>
    </section>
  );
}

/* ---------------- 10. FAQ ---------------- */

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "¿Qué incluye la membresía?",
    a: (
      <div className="space-y-3">
        <p>Depende del nivel que elijas:</p>
        <ul className="space-y-1.5">
          <li>
            <strong className="text-wit-ink">Essential</strong> — 10 solicitudes de diseño y 2
            campañas publicitarias al mes, con acompañamiento estratégico y entregas en alta
            resolución.
          </li>
          <li>
            <strong className="text-wit-ink">Grow</strong> — 15 solicitudes, 3 campañas, más
            carruseles y videos para redes, planeación de contenido, asesoría estratégica
            personalizada y reporte semanal de desempeño.
          </li>
          <li>
            <strong className="text-wit-ink">Scale</strong> — 20 solicitudes, 4 campañas, más
            carruseles y videos, auditoría y reunión mensual de estrategia, y prioridad alta en
            tiempos de entrega.
          </li>
        </ul>
        <p>Los tres incluyen panel exclusivo para dar seguimiento a cada solicitud.</p>
      </div>
    ),
  },
  {
    q: "¿Cómo funciona la promoción de julio 2026?",
    a: `Los nuevos suscriptores obtienen 30% de descuento durante sus primeros ${PROMO_MESES} meses consecutivos. A partir del mes ${PROMO_MESES + 1}, la mensualidad se cobra al precio regular del paquete contratado. Todos los precios publicados son más IVA.`,
  },
  {
    q: "¿Cómo se paga?",
    a: (
      <div className="space-y-3">
        <p>
          Con tarjeta de crédito o débito desde la propia plataforma, mes a mes. Elige el nivel que
          mejor se ajuste a tu marca — Essential, Grow o Scale — y tu cuenta se activa de inmediato.
        </p>
        <p>
          La suscripción se renueva automáticamente cada mes. Puedes cancelarla cuando quieras, sin
          penalización; la cancelación aplica al terminar el periodo ya pagado, sin reembolsos por
          el tiempo restante. Consulta los{" "}
          <Link to="/terminos" className="font-semibold text-wit-blue underline">
            términos y condiciones
          </Link>{" "}
          completos.
        </p>
      </div>
    ),
  },
  {
    q: "¿Cómo uso la plataforma?",
    a: "Crea tu cuenta, activa tu membresía y entra a tu panel. Ahí describes la imagen que necesitas (producto, estilo, formato), envías la solicitud y das seguimiento a su estado hasta descargar el resultado final.",
  },
  {
    q: "¿Qué tipo de imágenes puedo solicitar?",
    a: "Creatividades publicitarias para redes sociales, anuncios, banners, imágenes de producto y piezas de campaña. Cada solicitud la trabaja el equipo de WITERS, con IA como herramienta de apoyo.",
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
                    <div className="pb-5 text-[15px] leading-relaxed text-wit-gray [&_li]:list-disc [&_li]:ml-5 [&_ul]:space-y-1.5">
                      {f.a}
                    </div>
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
