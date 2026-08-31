import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Megaphone,
  MonitorSmartphone,
  Send,
  Sparkles,
} from "lucide-react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { WMark } from "../components/witers/brand";
import { MembershipComparisonTable } from "../components/witers/membership-comparison-table";
import { MembershipPlanCards } from "../components/witers/membership-cards";
import { MetaAdsDashboardCard, WhatsAppPhoneMockup } from "../components/witers/meta-ads-card";
import { PanelPreviewShowcase } from "../components/witers/panel-preview-showcase";
import {
  AspectRatioPicker,
  ColorsPicker,
  PieceTypePicker,
  StylePicker,
} from "../components/witers/lab-pickers";
import { useDraggableMarquee } from "../hooks/use-draggable-marquee";
import { useLanguage } from "../lib/i18n";
import { PROMO_MESES } from "../lib/membership-plans";
import { saveTeaserAnswers } from "../lib/teaser-handoff";
import { trackCtaClick } from "../lib/track-click";
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WITERS. La comunidad del ingenio" },
      {
        name: "description",
        content:
          "Planifica, crea y publica todo un mes de contenido desde un solo lugar con WITERS.",
      },
    ],
    links: [{ rel: "canonical", href: "https://witers.com/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader landing />
      <Hero />
      <HowItWorks />
      <Capabilities />
      <DevicesSection />
      <MarcasQueConfian />
      <SinglePlan />
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
  const { t } = useLanguage();
  const STAR_PATH =
    "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.539 1.118l-3.367-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.98 9.385c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z";
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={t(`${rating} de 5 estrellas`, `${rating} out of 5 stars`)}
    >
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
  const { t } = useLanguage();

  return (
    <section id="producto" className="relative overflow-hidden bg-[#fbfcff] pb-16 pt-28 md:pb-28 md:pt-36">
      <div aria-hidden="true" className="absolute -right-48 top-12 h-[34rem] w-[34rem] rounded-full bg-wit-mist/40 blur-3xl" />
      <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-5 md:px-10 lg:grid-cols-[0.78fr_1.22fr] lg:px-[7vw]">
        <div className="max-w-xl text-center lg:text-left">
          <span className="inline-flex rounded-full border border-wit-blue/15 bg-white px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-wit-blue shadow-sm">{t("Todo en un solo lugar", "Everything in one place")}</span>
          <h1 className="mt-6 text-[clamp(2.55rem,7vw,5.5rem)] font-extrabold leading-[0.98] tracking-[-0.06em] text-wit-ink">
            {t("Planifica, crea y publica", "Plan, create and publish")}<br />
            {t("todo un mes de contenido.", "a whole month of content.")}<br />
            <span className="wit-underline text-wit-blue">{t("En minutos.", "In minutes.")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-wit-gray sm:text-lg lg:mx-0">{t("Tu estrategia, tus piezas, tus redes y tu calendario trabajando juntos para hacer crecer tu marca.", "Your strategy, pieces, social networks and calendar working together to grow your brand.")}</p>
          <div className="mt-8 flex flex-col items-center gap-4 lg:items-start">
            <Link to={signedIn ? "/panel" : "/registro"} onClick={() => trackCtaClick("Empezar ahora (hero landing)")} className="wit-brand-gradient group inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_16px_35px_rgba(77,55,231,0.24)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]">
              {t("Empezar ahora", "Start now")} <span aria-hidden="true" className="text-lg leading-none">↗</span>
            </Link>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-semibold text-wit-gray lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-wit-blue" />{t("Todo incluido", "Everything included")}</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-wit-blue" />{t("Cancela cuando quieras", "Cancel anytime")}</span>
            </div>
          </div>
        </div>
        <ProductHeroMockup />
      </div>
    </section>
  );
}

function ProductHeroMockup() {
  const tiles = ["brand-example-fitzone.webp", "brand-example-mia.webp", "brand-example-alma.webp", "brand-example-lumina.webp", "brand-example-noa.webp"];
  return (
    <div className="relative mx-auto w-full max-w-[790px] pb-7 pt-2 lg:pt-8">
      <div className="overflow-hidden rounded-[28px] border border-wit-ink/10 bg-white p-2 shadow-[0_28px_75px_rgba(5,13,40,0.14)] sm:p-3">
        <div className="flex min-h-[335px] overflow-hidden rounded-[20px] bg-[#f7f8fa] sm:min-h-[430px]">
          <aside className="hidden w-[112px] shrink-0 border-r border-wit-ink/5 bg-white p-3 sm:block"><div className="flex items-center gap-1.5 text-[9px] font-extrabold text-wit-ink"><WMark size={20} /> WITERS</div><div className="mt-8 space-y-3 text-[8px] font-bold text-wit-gray"><p className="rounded-lg bg-wit-blue/10 px-2 py-2 text-wit-blue">Inicio</p><p className="px-2">Mi marca</p><p className="px-2">Calendario</p><p className="px-2">Campañas</p></div></aside>
          <div className="min-w-0 flex-1 p-3 sm:p-5"><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-semibold text-wit-gray">Hola, Hildebrando</p><p className="mt-1 text-sm font-extrabold text-wit-ink sm:text-lg">Planificación</p></div><span className="wit-brand-gradient rounded-full px-3 py-2 text-[8px] font-bold text-white sm:px-4 sm:text-[10px]">+ Programar mes</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1.5"><span className="rounded-full border border-wit-ink/10 bg-white px-2 py-1 text-[7px] font-bold text-wit-gray sm:text-[9px]">◎ witersclub</span><span className="rounded-full border border-wit-ink/10 bg-white px-2 py-1 text-[7px] font-bold text-wit-gray sm:text-[9px]">f Witers</span></div><span className="text-[8px] font-extrabold text-wit-blue sm:text-[10px]">8 de 8 piezas · 100%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-wit-mist"><div className="wit-brand-gradient h-full w-[78%] rounded-full" /></div><div className="mt-4 rounded-2xl bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><p className="text-[9px] font-extrabold text-wit-ink sm:text-[11px]">Agosto 2026</p><span className="text-[8px] font-bold text-wit-blue">Ver calendario →</span></div><div className="mt-3 grid grid-cols-7 gap-1 text-center text-[7px] font-bold text-wit-gray sm:gap-2 sm:text-[8px]">{["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map((day) => <span key={day}>{day}</span>)}{Array.from({ length: 14 }, (_, index) => <div key={index} className="aspect-square min-w-0 overflow-hidden rounded-md bg-wit-ice p-1 text-left sm:rounded-lg"><span>{index + 18}</span>{index >= 7 && index < 12 ? <img src={`/assets/${tiles[index - 7]}`} alt="" className="mt-0.5 h-[67%] w-full rounded-sm object-cover" /> : null}</div>)}</div></div></div>
        </div>
      </div>
      <div className="absolute -bottom-3 left-3 w-[142px] overflow-hidden rounded-[1.65rem] border-[5px] border-wit-ink bg-[#f7f8fa] p-2 shadow-[0_18px_38px_rgba(5,13,40,0.23)] sm:-bottom-8 sm:left-7 sm:w-[190px]"><div className="mx-auto h-3 w-14 rounded-b-lg bg-wit-ink" /><p className="mt-3 text-[8px] font-bold text-wit-gray">Tu contenido</p><p className="text-xs font-extrabold text-wit-ink">Calendario</p><div className="mt-3 grid grid-cols-4 gap-1">{Array.from({ length: 12 }, (_, i) => <span key={i} className={`aspect-square rounded-sm ${i % 3 === 0 ? "bg-wit-blue" : "bg-wit-mist"}`} />)}</div></div>
    </div>
  );
}

function HeroPhoneDemo() {
  const { t } = useLanguage();
  const calendarItems = ["bg-wit-blue", "bg-wit-pink", "bg-emerald-500", "bg-amber-400", "bg-wit-blue", "bg-wit-pink", "bg-violet-500", "bg-emerald-500", "bg-wit-blue", "bg-amber-400", "bg-wit-pink", "bg-wit-blue", "bg-emerald-500", "bg-violet-500", "bg-wit-pink"];
  return <div className="wit-hero-phone-stage" aria-label={t("Calendario de contenido de WITERS", "WITERS content calendar")}>
    <div className="wit-hero-phone-entry"><div className="wit-hero-phone"><div className="relative h-[480px] overflow-hidden rounded-[2.15rem] bg-[#f7f8fa] p-3 sm:h-[530px]">
      <div className="absolute left-1/2 top-0 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-wit-ink" />
      <div className="flex items-center justify-between px-1 pt-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-wit-blue"><span className="brightness-0 invert"><WMark size={14} /></span></span><span className="text-[10px] font-extrabold tracking-tight text-wit-ink">WITERS</span></div><span className="rounded-full bg-white px-2 py-1 text-[8px] font-bold text-wit-gray shadow-sm">{t("Tu espacio", "Your space")}</span></div>
      <div className="mt-5 px-1"><p className="text-[11px] font-semibold text-wit-gray">{t("Tu contenido", "Your content")}</p><p className="mt-0.5 text-xl font-extrabold tracking-tight text-wit-ink">{t("Calendario de junio", "June calendar")}</p></div>
      <div className="mt-4 rounded-3xl bg-white p-3 shadow-[0_16px_35px_rgba(5,13,40,0.12)]"><div className="flex items-center justify-between"><span className="text-[9px] font-extrabold text-wit-ink">{t("PLANIFICADO", "PLANNED")}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-600">15 {t("piezas", "pieces")}</span></div><div className="mt-3 grid grid-cols-5 gap-1.5">{calendarItems.map((color, index) => <div key={index} className="relative aspect-square rounded-lg bg-wit-ice p-1"><span className="text-[7px] font-bold text-wit-gray">{index + 3}</span>{index < 15 ? <span className={`absolute inset-x-1 bottom-1 h-2.5 rounded-sm ${color}`} /> : null}</div>)}</div><div className="mt-3 flex items-center justify-between border-t border-wit-ink/5 pt-2.5"><span className="text-[8px] font-semibold text-wit-gray">{t("Imagen · Video · Carrusel", "Image · Video · Carousel")}</span><span className="text-[8px] font-extrabold text-wit-blue">{t("Ver todo", "See all")}</span></div></div>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-full bg-white/90 px-4 py-3 shadow-[0_8px_20px_rgba(5,13,40,0.12)] backdrop-blur"><span className="h-2 w-2 rounded-full bg-wit-blue" /><span className="h-2 w-2 rounded-full bg-wit-blue/20" /><span className="h-2 w-2 rounded-full bg-wit-blue/20" /><span className="text-[9px] font-extrabold text-wit-blue">{t("CALENDARIO", "CALENDAR")}</span></div>
    </div></div></div>
  </div>;
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-wit-blue">{children}</p>;
}

function HowItWorks() {
  const steps = [
    { icon: CalendarDays, title: "Planea", text: "Organiza tu mes y define la estrategia de tu marca." },
    { icon: Sparkles, title: "Creamos", text: "Preparamos el contenido que necesitas respetando tu identidad." },
    { icon: Send, title: "Programas", text: "Revisa, aprueba y deja listo tu contenido." },
    { icon: BarChart3, title: "Publicamos", text: "Publicamos en tus redes conectadas y consultas resultados." },
  ];
  return <section id="funciones" className="bg-white py-20 md:py-28"><div className="mx-auto max-w-6xl px-5 md:px-10"><div className="text-center"><SectionEyebrow>Así funciona WITERS</SectionEyebrow><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-wit-ink md:text-5xl">De una idea a todo tu mes, en 4 pasos</h2></div><div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <article key={step.title} className="relative rounded-[24px] border border-wit-ink/7 bg-[#fbfcff] p-6 transition-transform duration-300 hover:-translate-y-1"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wit-blue/10 text-wit-blue"><step.icon className="h-5 w-5" /></span><span className="absolute right-5 top-6 font-wit-mono text-xs font-semibold text-wit-blue/45">0{index + 1}</span><h3 className="mt-5 text-lg font-extrabold uppercase tracking-wide text-wit-ink">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-wit-gray">{step.text}</p></article>)}</div></div></section>;
}

function Capabilities() {
  const features = [
    { icon: ImageIcon, title: "Contenido para tu marca", text: "Imágenes, reels, carruseles y copies manteniendo tu identidad." },
    { icon: CalendarDays, title: "Planificación", text: "Organiza visualmente tu contenido y tu calendario mensual." },
    { icon: Send, title: "Publicación automática", text: "Programa Instagram y Facebook desde WITERS." },
    { icon: Megaphone, title: "Campañas", text: "Convierte tus mejores piezas en campañas de Meta Ads." },
    { icon: BarChart3, title: "Reportes y resultados", text: "Consulta métricas y entiende qué está funcionando." },
  ];
  return <section className="bg-[#f7f8fa] py-20 md:py-28"><div className="mx-auto max-w-6xl px-5 md:px-10"><SectionEyebrow>Todo lo que puedes hacer</SectionEyebrow><h2 className="mt-3 max-w-lg text-3xl font-extrabold tracking-[-0.04em] text-wit-ink md:text-5xl">Todo tu contenido, conectado.</h2><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article className="rounded-[28px] bg-wit-navy p-7 text-white sm:col-span-2 lg:row-span-2"><ImageIcon className="h-7 w-7 text-[#9db4ff]" /><h3 className="mt-12 text-2xl font-extrabold">{features[0].title}</h3><p className="mt-3 max-w-sm text-base leading-relaxed text-white/65">{features[0].text}</p></article>{features.slice(1).map((feature) => <article key={feature.title} className="rounded-[24px] border border-wit-ink/7 bg-white p-6 transition-transform duration-300 hover:-translate-y-1"><feature.icon className="h-6 w-6 text-wit-blue" /><h3 className="mt-7 text-lg font-extrabold text-wit-ink">{feature.title}</h3><p className="mt-2 text-sm leading-relaxed text-wit-gray">{feature.text}</p></article>)}</div></div></section>;
}

function DevicesSection() {
  const benefits = ["Aprueba y revisa piezas", "Consulta tu calendario", "Programa publicaciones", "Revisa tus campañas y resultados"];
  return <section className="overflow-hidden bg-white py-20 md:py-28"><div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:px-10 lg:grid-cols-[1fr_1.05fr]"><div className="order-2 lg:order-1"><SectionEyebrow>Experiencia desktop + móvil</SectionEyebrow><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-wit-ink md:text-5xl">Tu contenido, donde estés.</h2><p className="mt-5 max-w-md text-lg leading-relaxed text-wit-gray">Revisa y administra todo desde tu teléfono.</p><ul className="mt-7 space-y-3">{benefits.map((benefit) => <li key={benefit} className="flex items-center gap-3 text-sm font-semibold text-wit-ink"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-wit-blue/10"><Check className="h-3.5 w-3.5 text-wit-blue" /></span>{benefit}</li>)}</ul></div><div className="order-1 relative mx-auto w-full max-w-xl lg:order-2"><div className="rounded-[28px] border border-wit-ink/10 bg-[#f7f8fa] p-4 shadow-[0_22px_55px_rgba(5,13,40,0.1)]"><div className="flex items-center gap-1.5 border-b border-wit-ink/5 pb-3"><span className="h-2 w-2 rounded-full bg-wit-pink" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><div className="mt-4 grid grid-cols-[0.32fr_1fr] gap-3"><div className="rounded-xl bg-white p-3 text-[8px] font-bold text-wit-gray"><WMark size={18} /><p className="mt-5 rounded bg-wit-blue/10 p-2 text-wit-blue">Inicio</p><p className="mt-3">Calendario</p><p className="mt-3">Campañas</p></div><div className="rounded-xl bg-white p-4"><p className="text-sm font-extrabold text-wit-ink">Tu calendario</p><div className="mt-3 grid grid-cols-7 gap-1.5">{Array.from({ length: 28 }, (_, i) => <span key={i} className={`aspect-square rounded-sm ${i % 6 === 0 ? "wit-brand-gradient" : "bg-wit-mist/55"}`} />)}</div><div className="mt-4 grid grid-cols-3 gap-2"><span className="h-12 rounded-lg bg-wit-mist/65" /><span className="h-12 rounded-lg bg-wit-blue/10" /><span className="h-12 rounded-lg bg-wit-pink/10" /></div></div></div></div><div className="absolute -bottom-9 -left-2 w-[150px] rounded-[28px] border-[5px] border-wit-ink bg-white p-3 shadow-[0_20px_42px_rgba(5,13,40,0.2)] sm:-left-8 sm:w-[180px]"><MonitorSmartphone className="h-5 w-5 text-wit-blue" /><p className="mt-5 text-xs font-extrabold text-wit-ink">Calendario</p><div className="mt-3 grid grid-cols-4 gap-1">{Array.from({ length: 12 }, (_, i) => <span key={i} className={`aspect-square rounded-sm ${i % 4 === 0 ? "bg-wit-pink" : "bg-wit-mist"}`} />)}</div></div></div></div></section>;
}

/* ---------------- 1a. RESULTADOS REALES (imagen + reseña) ---------------- */

function Testimonios() {
  const { t } = useLanguage();
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
          {t("Resultados reales", "Real results")}
        </p>
        <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
          {t("Lo que dicen quienes ya", "What those who already")}{" "}
          <span className="wit-underline italic text-wit-blue">
            {t("confiaron en nosotros", "trusted us have to say")}
          </span>
          .
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
  const { t } = useLanguage();
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
    <section id="resultados" className="relative bg-white py-20 md:py-24">
      <div className="px-5 md:px-[110px]">
        <p className="text-center text-base text-wit-gray">
          {t("Marcas que ya confían en", "Brands that already trust")}{" "}
          <strong className="text-wit-ink">WITERS</strong>
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
  {
    field: "pieceType",
    es: "¿Qué tipo de pieza quieres crear hoy?",
    en: "What type of piece do you want to create today?",
  },
  {
    field: "aspectRatio",
    es: "¿Qué forma tiene la pieza que te imaginas?",
    en: "What shape does the piece you're imagining have?",
  },
  {
    field: "colors",
    es: "¿Tienes colores de marca? Si no, elige los que más te gusten.",
    en: "Do you have brand colors? If not, pick the ones you like best.",
  },
  {
    field: "style",
    es: "¿Qué estilo visual te gustaría?",
    en: "What visual style would you like?",
  },
] as const;

function PruebaInteractiva() {
  const { t } = useLanguage();
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
          {t("Pruébalo tú mismo", "Try it yourself")}
        </p>
        <h2 className="wit-rise mt-2 text-center text-2xl font-extrabold tracking-tighter text-wit-ink md:text-3xl">
          {t("Arma tu pieza en 4 pasos", "Build your piece in 4 steps")}
        </h2>

        <div className="wit-glass mt-8 rounded-3xl p-6 shadow-[0_20px_50px_rgba(5,13,40,0.08)]">
          {!started ? (
            <div className="flex flex-col items-center gap-6 py-4 text-center">
              <div className="wit-float">
                <WMark size={34} />
              </div>
              <p className="max-w-xs text-sm text-wit-gray">
                {t(
                  "Cuéntanos qué quieres crear hoy y armamos tu pieza juntos.",
                  "Tell us what you want to create today and we'll build your piece together.",
                )}
              </p>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="wit-glow-button flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(255,63,176,0.35)] transition-transform active:scale-[0.97]"
              >
                ✨ {t("Habla con Wit", "Talk to Wit")} ✨
              </button>
            </div>
          ) : !done ? (
            <>
              <div className="mb-5 flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
                  <WMark size={13} />
                </span>
                <p className="rounded-2xl rounded-bl-sm bg-wit-mist/50 px-4 py-2.5 text-sm text-wit-ink">
                  {t(current.es, current.en)}
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
              <p className="text-base font-bold text-wit-ink">
                {t("¡Nos encantó lo que armaste!", "We loved what you put together!")}
              </p>
              <p className="text-sm text-wit-gray">
                {t(
                  "Crea tu cuenta para que empecemos a diseñar tu pieza de verdad.",
                  "Create your account so we can start designing your piece for real.",
                )}
              </p>
              <div className="mt-2 flex w-full flex-col gap-2">
                <Link
                  to="/registro"
                  onClick={() => {
                    saveTeaserAnswers(answers);
                    trackCtaClick("Crear cuenta gratis (Habla con Wit)");
                  }}
                  className="rounded-full bg-wit-blue px-6 py-3 text-center text-sm font-bold text-white hover:bg-wit-blue-deep"
                >
                  {t("Crear cuenta gratis", "Create free account")}
                </Link>
                <Link
                  to="/ingresar"
                  onClick={() => saveTeaserAnswers(answers)}
                  className="rounded-full border border-wit-ink/15 px-6 py-3 text-center text-sm font-bold text-wit-ink hover:bg-wit-mist/40"
                >
                  {t("Ya tengo cuenta", "I already have an account")}
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

function SinglePlan() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const benefits = ["Creación de contenido para tu marca", "Calendario y planificación", "Programación de contenido", "Publicación en redes conectadas", "Gestión de marca y campañas", "Reportes y analítica"];
  return <section id="precio" className="bg-[#f7f8fa] py-20 md:py-28"><div className="mx-auto max-w-5xl px-5 text-center md:px-10"><SectionEyebrow>Todo WITERS. Un solo plan.</SectionEyebrow><h2 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold tracking-[-0.04em] text-wit-ink md:text-5xl">Todo lo que necesitas para llevar el contenido de tu marca.</h2><article className="relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-[32px] bg-wit-navy px-6 py-8 text-left shadow-[0_30px_80px_rgba(5,13,40,0.2)] sm:px-10 sm:py-11"><div aria-hidden="true" className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-wit-blue/30 blur-3xl" /><div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end"><div><p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#a9bbff]">WITERS completo</p><p className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-5xl">$599.00 <span className="text-lg font-semibold text-white/60">MXN / mes</span></p><p className="mt-3 text-base text-white/65">Todo incluido.</p></div><Link to={signedIn ? "/panel" : "/registro"} onClick={() => trackCtaClick("Empezar con WITERS (precio)")} className="wit-brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-extrabold uppercase tracking-[0.06em] text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]">Empezar con WITERS <ChevronRight className="h-4 w-4" /></Link></div><ul className="relative mt-9 grid gap-3 border-t border-white/10 pt-7 sm:grid-cols-2">{benefits.map((benefit) => <li key={benefit} className="flex items-center gap-2.5 text-sm font-medium text-white/85"><Check className="h-4 w-4 shrink-0 text-[#a9bbff]" />{benefit}</li>)}</ul><p className="relative mt-7 text-sm text-white/55">Cancela cuando quieras.</p></article></div></section>;
}

function CtaFinal() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-white py-16 md:py-24">
      <div className="mx-5 flex flex-col items-start gap-8 rounded-[32px] bg-wit-navy px-7 py-10 md:mx-[7vw] md:flex-row md:items-center md:justify-between md:px-12 md:py-14">
        <h2 className="text-3xl font-extrabold tracking-[-0.05em] text-white md:text-5xl">
          {t("Tu próximo mes de contenido", "Your next month of content")}
          <br />
          {t("Hagamos que el mundo", "Let's make the world")}{" "}
          <span className="italic text-wit-blue">{t("la vea", "see it")}</span>.
        </h2>
        <Link
          to={signedIn ? "/panel" : "/registro"}
          onClick={() => trackCtaClick("Hablemos de tu proyecto (CTA final)")}
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-wit-ink/15 bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.08)] transition-all duration-200 hover:bg-wit-ink hover:text-white active:scale-[0.98]"
        >
          {t("Hablemos de tu proyecto", "Let's talk about your project")}
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
  const { t } = useLanguage();
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
            {t("Promoción 2026 · Para nuevos suscriptores", "2026 Promo · For new subscribers")}
          </span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tighter text-white md:text-6xl">
            {t("Únete a la comunidad", "Join the community")}
            <br />
            {t("del", "of")}{" "}
            <span className="wit-underline text-[#5c85ff]">{t("ingenio", "ingenuity")}</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            {t(
              "Elige el nivel de acompañamiento que tu marca necesita. Todo el poder del",
              "Choose the level of support your brand needs. All the power of",
            )}{" "}
            <strong className="text-white">{t("ingenio", "ingenuity")}</strong>
            {t(", la", ",")} <strong className="text-white">{t("estrategia", "strategy")}</strong>{" "}
            {t("y la", "and")}{" "}
            <strong className="text-white">
              {t("inteligencia artificial", "artificial intelligence")}
            </strong>{" "}
            {t("trabajando para ti.", "working for you.")}
          </p>
        </div>

        <MembershipPlanCards
          ctaFor={(m) => ({
            to: signedIn ? "/checkout" : "/registro",
            search: { plan: m.id },
            label: t(`Quiero ${m.nombre}`, `I want ${m.nombre}`),
          })}
        />
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-white/50">
          {t(
            "Pago con tarjeta de crédito o débito. Activación inmediata. Suscripción con renovación automática mensual — puedes cancelar cuando quieras.",
            "Pay with credit or debit card. Immediate activation. Subscription with automatic monthly renewal — cancel anytime.",
          )}{" "}
          <Link to="/terminos" className="underline hover:text-white">
            {t("Ver términos y condiciones", "View terms and conditions")}
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
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-5 text-center md:px-[110px]">
        <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-5xl">
          {t("De la pieza a la", "From piece to")}{" "}
          <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
            {t("campaña", "campaign")}
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
            {t("Tu pieza no se queda", "Your piece doesn't stop")}
            <br />
            {t("en", "at")}{" "}
            <span className="italic text-wit-blue">"{t("me gusta", "a like")}"</span>.
          </h3>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-wit-gray">
            {t(
              "El equipo de WITERS se encarga de que tenga el mayor alcance para tus ventas — la convertimos en una campaña real de Meta Ads, configurada, medible y lista para vender. Sin salir de WITERS.",
              "The WITERS team makes sure it gets the reach your sales need — we turn it into a real Meta Ads campaign, fully set up, measurable, and ready to sell. Without ever leaving WITERS.",
            )}
          </p>
          <Link
            to="/pauta"
            className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
          >
            {t("Quiero campañas", "I want campaigns")}
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

/* ---------------- 9c. VISTA DEL PANEL ---------------- */

function PanelPreview() {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-wit-mist/30 py-20 md:py-28">
      <div className="px-5 text-center md:px-[110px]">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-blue">
          {t("Así se ve por dentro", "A look inside")}
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
          {t("Tu panel, con todo lo que", "Your panel, with everything you")}{" "}
          <span className="wit-underline italic text-wit-blue">
            {t("necesitas ver", "need to see")}
          </span>
          .
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-wit-gray">
          {t(
            "Tus piezas listas y tus campañas con resultados reales, en el mismo lugar — sin instalar nada, desde tu teléfono.",
            "Your finished pieces and your campaigns' real results, in the same place — no install, right from your phone.",
          )}
        </p>
      </div>

      <div className="mt-16 px-5 md:px-[110px]">
        <PanelPreviewShowcase />
      </div>
    </section>
  );
}

/* ---------------- 10. FAQ ---------------- */

type FaqEntry = { q: string; a: ReactNode };

function buildFaqsEs(): FaqEntry[] {
  return [
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
            Con tarjeta de crédito o débito desde la propia plataforma, mes a mes. Elige el nivel
            que mejor se ajuste a tu marca — Essential, Grow o Scale — y tu cuenta se activa de
            inmediato.
          </p>
          <p>
            La suscripción se renueva automáticamente cada mes. Puedes cancelarla cuando quieras,
            sin penalización; la cancelación aplica al terminar el periodo ya pagado, sin reembolsos
            por el tiempo restante. Consulta los{" "}
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
}

function buildFaqsEn(): FaqEntry[] {
  return [
    {
      q: "What's included in the membership?",
      a: (
        <div className="space-y-3">
          <p>It depends on the tier you choose:</p>
          <ul className="space-y-1.5">
            <li>
              <strong className="text-wit-ink">Essential</strong> — 10 design requests and 2 ad
              campaigns a month, with strategic support and high-resolution deliverables.
            </li>
            <li>
              <strong className="text-wit-ink">Grow</strong> — 15 requests, 3 campaigns, plus
              carousels and videos for social, content planning, personalized strategic advice, and
              a weekly performance report.
            </li>
            <li>
              <strong className="text-wit-ink">Scale</strong> — 20 requests, 4 campaigns, plus
              carousels and videos, a monthly audit and strategy meeting, and top priority on
              turnaround times.
            </li>
          </ul>
          <p>All three include an exclusive panel to track every request.</p>
        </div>
      ),
    },
    {
      q: "How does the July 2026 promotion work?",
      a: `New subscribers get a 30% discount for their first ${PROMO_MESES} consecutive months. Starting month ${PROMO_MESES + 1}, the monthly fee is charged at the regular price of the plan you signed up for. All published prices are before tax.`,
    },
    {
      q: "How do I pay?",
      a: (
        <div className="space-y-3">
          <p>
            With a credit or debit card right on the platform, month to month. Choose the tier that
            best fits your brand — Essential, Grow, or Scale — and your account activates
            immediately.
          </p>
          <p>
            The subscription renews automatically every month. You can cancel anytime, with no
            penalty; cancellation takes effect at the end of the period you've already paid for,
            with no refunds for remaining time. See the full{" "}
            <Link to="/terminos" className="font-semibold text-wit-blue underline">
              terms and conditions
            </Link>
            .
          </p>
        </div>
      ),
    },
    {
      q: "How do I use the platform?",
      a: "Create your account, activate your membership, and go to your panel. There you describe the image you need (product, style, format), submit the request, and track its status until you download the final result.",
    },
    {
      q: "What kind of images can I request?",
      a: "Ad creatives for social media, ads, banners, product images, and campaign pieces. Every request is worked by the WITERS team, using AI as a supporting tool.",
    },
  ];
}

function Faq() {
  const { lang } = useLanguage();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const faqs: FaqEntry[] = lang === "en"
    ? [
        { q: "Can I try WITERS before paying?", a: "Create your account to get to know the platform and its onboarding flow. Membership activation and its conditions are shown before checkout." },
        { q: "Which social networks can I connect?", a: "WITERS currently supports the connected Instagram and Facebook accounts available in your panel." },
        { q: "How does scheduling work?", a: "You choose eligible planned pieces and their publishing time. WITERS stores the schedule and publishes through the connected social account." },
        { q: "What content can I create?", a: "The platform supports image, video, carousel and copy requests, according to your active membership and the availability shown in your panel." },
        { q: "Can I cancel whenever I want?", a: "You can review the cancellation terms before subscribing and from your account. Cancellation applies according to the terms of the active membership." },
        { q: "How do campaigns work?", a: "Campaign tools let you work with Meta Ads from WITERS and review the associated results in your panel." },
      ]
    : [
        { q: "¿Puedo probar WITERS antes de pagar?", a: "Puedes crear tu cuenta para conocer la plataforma y su flujo de bienvenida. La activación de la membresía y sus condiciones se muestran antes de pagar." },
        { q: "¿Qué redes sociales puedo conectar?", a: "WITERS admite actualmente las cuentas conectadas de Instagram y Facebook que estén disponibles en tu panel." },
        { q: "¿Cómo funciona la programación?", a: "Eliges las piezas planeadas que son aptas para publicar y su horario. WITERS guarda la programación y publica mediante la cuenta social conectada." },
        { q: "¿Qué contenido puedo crear?", a: "La plataforma admite solicitudes de imagen, video, carrusel y copy, de acuerdo con tu membresía activa y la disponibilidad mostrada en tu panel." },
        { q: "¿Puedo cancelar cuando quiera?", a: "Puedes revisar las condiciones de cancelación antes de suscribirte y desde tu cuenta. La cancelación se aplica conforme a los términos de la membresía activa." },
        { q: "¿Cómo funcionan las campañas?", a: "Las herramientas de campañas permiten trabajar con Meta Ads desde WITERS y revisar los resultados asociados en tu panel." },
      ];
  return (
    <section className="relative bg-white py-20 md:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <SectionEyebrow>Preguntas frecuentes</SectionEyebrow>
        <h2 className="mt-3 text-center text-3xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
          {lang === "en" ? (
            <>
              We answer your <span className="wit-underline text-wit-blue">questions</span>
            </>
          ) : (
            <>
              Resolvemos tus <span className="wit-underline text-wit-blue">dudas</span>
            </>
          )}
        </h2>
        <div className="mt-10 divide-y divide-wit-ink/10 border-y border-wit-ink/10">
          {faqs.map((f, i) => {
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
