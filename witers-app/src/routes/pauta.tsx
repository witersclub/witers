import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  MapPinned,
  PauseCircle,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users2,
  Wand2,
} from "lucide-react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { WMark } from "../components/witers/brand";
import { MetaAdsDashboardCard, WhatsAppPhoneMockup } from "../components/witers/meta-ads-card";
import {
  CampaignJourneyMobile,
  CampaignJourneyScroller,
} from "../components/witers/campaign-journey-scroller";
import { useMe } from "../lib/witers-client";
import { useLanguage } from "../lib/i18n";
import { trackCtaClick } from "../lib/track-click";

export const Route = createFileRoute("/pauta")({
  head: () => ({
    meta: [
      { title: "Campañas de Meta Ads. WITERS" },
      {
        name: "description",
        content:
          "El equipo de WITERS se encarga de que tus creatividades tengan el mayor alcance para tus ventas: las convertimos en una campaña real de Meta Ads, configurada y en pausa hasta que tú decidas activarla.",
      },
    ],
  }),
  component: PautaLanding,
});

function PautaLanding() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />
      <Hero />
      <ComoTrabajamos />
      <Rendimientos />
      <PorQue />
      <CtaFinal />
      <SiteFooter />
    </div>
  );
}

/* ---------------- 1. HERO ---------------- */

function Hero() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const { t } = useLanguage();
  return (
    <section className="relative pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="relative mx-auto max-w-3xl px-5 text-center md:px-[110px]">
        <span className="wit-rise inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue backdrop-blur-sm">
          {t("Meta Ads · Campañas reales", "Meta Ads · Real Campaigns")}
        </span>
      </div>

      <div className="wit-rise wit-rise-d1 relative mt-8 px-5 lg:hidden">
        <div className="relative mx-auto max-w-md pb-8 pl-8 pt-4 sm:pb-14 sm:pl-16">
          <MetaAdsDashboardCard />
          <WhatsAppPhoneMockup className="absolute -bottom-6 -left-2 z-10 sm:-bottom-10 sm:-left-6" />
        </div>
      </div>

      {/* Desktop shows this same headline/CTA anchored under the left
          mockup instead, inside CampaignJourneyScroller — keeps the hero
          one horizontal composition instead of stacking a big centered
          text band underneath everything. On mobile it sits between the
          dashboard mockup above and the step-by-step phones below — it's
          the sell, so it stays close to the top instead of trailing after
          the phones. */}
      <div className="relative mx-auto mt-8 max-w-3xl px-5 text-center md:px-[110px] lg:hidden">
        <h1 className="wit-rise wit-rise-d2 mx-auto max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-7xl">
          {t("De la pieza a la", "From creative to")}{" "}
          <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
            {t("campaña", "campaign")}
          </span>
          .
        </h1>
        <p className="wit-rise wit-rise-d2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-wit-gray">
          {t(
            "El equipo de WITERS se encarga de que tus creatividades tengan el mayor alcance para tus ventas — las convertimos en una campaña real de Meta Ads, configurada en minutos y en pausa hasta que tú decidas encenderla.",
            "The WITERS team makes sure your creatives get maximum reach for your sales — we turn them into a real Meta Ads campaign, set up in minutes and paused until you decide to switch it on.",
          )}
        </p>
        <div className="wit-rise wit-rise-d2 mt-9 flex flex-col items-center gap-5">
          <Link
            to={signedIn ? "/panel" : "/registro"}
            onClick={() => trackCtaClick("Quiero pautar mis campañas (hero)")}
            className="group inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-8 py-4 text-base font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
          >
            {t("Quiero pautar mis campañas", "I want to run my campaigns")}
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
          <a href="#como-trabajamos" className="wit-navlink text-sm font-semibold text-wit-ink">
            {t("Ver cómo trabajamos", "See how we work")}
          </a>
        </div>
      </div>

      <CampaignJourneyMobile />
      <CampaignJourneyScroller />
    </section>
  );
}

/* ---------------- 2. CÓMO TRABAJAMOS ---------------- */

const PASOS = [
  {
    icon: Wand2,
    title: { es: "Creamos tu pieza", en: "We create your creative" },
    text: {
      es: "El equipo de WITERS arma tu creatividad publicitaria — con apoyo de IA, cuidando estilo, marca y mensaje — en minutos, dentro de tu panel.",
      en: "The WITERS team builds your ad creative — with AI support, keeping your style, brand and message on point — in minutes, right in your dashboard.",
    },
  },
  {
    icon: Target,
    title: { es: "Configuras tu campaña", en: "You set up your campaign" },
    text: {
      es: "Objetivo, presupuesto, duración, ubicación, edad e intereses, en un wizard guiado — sin abrir Meta Ads Manager ni leer manuales.",
      en: "Goal, budget, duration, location, age and interests, in a guided wizard — no need to open Meta Ads Manager or read manuals.",
    },
  },
  {
    icon: MapPinned,
    title: { es: "Escribimos el anuncio", en: "We write the ad copy" },
    text: {
      es: "Tres variantes de texto pensadas para vender, no solo para verse bien — redactadas con apoyo de IA y revisadas por nuestro equipo. Las puedes editar antes de continuar.",
      en: "Three copy variants built to sell, not just to look good — written with AI support and reviewed by our team. You can edit them before continuing.",
    },
  },
  {
    icon: PauseCircle,
    title: { es: "Se crea en pausa. Tú decides", en: "It's created paused. You decide" },
    text: {
      es: "Ninguna campaña gasta un peso hasta que tú la actives desde tu panel, cuando estés listo.",
      en: "No campaign spends a single peso until you activate it from your dashboard, whenever you're ready.",
    },
  },
];

function ComoTrabajamos() {
  const { t } = useLanguage();
  return (
    <section id="como-trabajamos" className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">
            {t("Cómo", "How")}
          </p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Trabajamos", "We Work")}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wit-gray">
            {t(
              "Todo pasa dentro de WITERS — la pieza y la campaña, en un solo lugar.",
              "Everything happens inside WITERS — the creative and the campaign, in one place.",
            )}
          </p>
        </div>

        <ol className="mx-auto mt-16 grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p, i) => (
            <li key={p.title.es} className="relative">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wit-mist/50 text-wit-blue">
                <p.icon size={26} strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-wit-blue">
                {t("Paso", "Step")} {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-lg font-bold text-wit-ink">{t(p.title.es, p.title.en)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-wit-gray">
                {t(p.text.es, p.text.en)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- 3. RENDIMIENTOS REALES ---------------- */

const RENDIMIENTO_STATS = [
  {
    value: "$188,104 MXN",
    label: { es: "En ventas generadas en 9 días", en: "In sales generated in 9 days" },
  },
  {
    value: "9.9%",
    label: { es: "De las ventas se invirtió en anuncios", en: "Of sales was invested in ads" },
  },
  { value: "826", label: { es: "Contactos nuevos generados", en: "New contacts generated" } },
  {
    value: "$22.62 MXN",
    label: { es: "Costo promedio por contacto nuevo", en: "Average cost per new contact" },
  },
];

const RENDIMIENTO_SERVICIOS = [
  {
    servicio: { es: "Suero + Hidrofacial", en: "Serum + Hydrofacial" },
    ventas: "$19,500",
    gasto: "$325",
    roas: "60.0×",
  },
  {
    servicio: { es: "Botox en pareja", en: "Couples Botox" },
    ventas: "$20,931",
    gasto: "$724",
    roas: "28.9×",
  },
  {
    servicio: { es: "HIFU V", en: "HIFU V" },
    ventas: "$15,800",
    gasto: "$2,251",
    roas: "7.0×",
  },
  {
    servicio: { es: "NCTF", en: "NCTF" },
    ventas: "$12,131",
    gasto: "$2,516",
    roas: "4.8×",
  },
];

function Rendimientos() {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-wit-navy py-20 text-white md:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-24 opacity-[0.07]"
      >
        <WMark size={560} />
      </div>
      <div className="relative px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white/80">
            <BarChart3 size={16} strokeWidth={2} />
            {t("Resultados reales", "Real results")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tighter md:text-5xl">
            {t("No prometemos.", "We don't promise.")}{" "}
            <span className="wit-underline text-[#5c85ff]">{t("Mostramos.", "We show.")}</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/70">
            {t(
              "Datos reales de una campaña de un cliente de WITERS — un negocio de estética en Tijuana. Se omite el nombre por privacidad; las cifras son las que reportó Meta, sin editar. Período: 1 al 9 de mayo de 2026.",
              "Real data from a WITERS client campaign — an aesthetics business in Tijuana. The name is withheld for privacy; the figures are exactly what Meta reported, unedited. Period: May 1–9, 2026.",
            )}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RENDIMIENTO_STATS.map((s) => (
            <div
              key={s.label.es}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
            >
              <p className="font-wit-mono text-3xl font-semibold">{s.value}</p>
              <p className="mt-2 text-xs leading-snug text-white/60">{t(s.label.es, s.label.en)}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#5c85ff]/30 bg-[#0047FF]/10 p-6 text-center">
          <p className="text-base leading-relaxed">
            {t(
              "El servicio con mejor desempeño del período tuvo un",
              "The top-performing service of the period had a",
            )}{" "}
            <strong className="text-white">{t("ROAS de 7.0×", "7.0× ROAS")}</strong>{" "}
            {t(
              "— $7 pesos vendidos por cada $1 invertido en anuncios — con un crecimiento de",
              "— $7 pesos in sales for every $1 spent on ads — with growth of",
            )}{" "}
            <strong className="text-white">+300%</strong>{" "}
            {t("respecto al período anterior.", "compared to the previous period.")}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
                <th className="px-5 py-3 font-semibold">{t("Servicio", "Service")}</th>
                <th className="px-5 py-3 font-semibold">{t("Ventas", "Sales")}</th>
                <th className="px-5 py-3 font-semibold">{t("Gasto en ads", "Ad spend")}</th>
                <th className="px-5 py-3 font-semibold">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {RENDIMIENTO_SERVICIOS.map((r) => (
                <tr key={r.servicio.es} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-white/90">{t(r.servicio.es, r.servicio.en)}</td>
                  <td className="px-5 py-3 text-white/70">{r.ventas}</td>
                  <td className="px-5 py-3 text-white/70">{r.gasto}</td>
                  <td className="px-5 py-3 font-semibold text-[#5c85ff]">{r.roas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-white/40">
          {t(
            "Los resultados varían según industria, ubicación, temporada y objetivos de cada negocio — estas cifras no son una garantía de resultados futuros, son el reporte real de un cliente durante el período indicado.",
            "Results vary by industry, location, season and each business's goals — these figures are not a guarantee of future results; they are the real report from a client during the stated period.",
          )}
        </p>
      </div>
    </section>
  );
}

/* ---------------- 4. POR QUÉ WITERS ---------------- */

const DIFERENCIADORES = [
  {
    icon: Rocket,
    title: { es: "Todo en un solo lugar", en: "Everything in one place" },
    text: {
      es: "La pieza y la campaña, sin subir archivos a otra plataforma ni copiar textos a mano.",
      en: "The creative and the campaign, without uploading files to another platform or copying text by hand.",
    },
  },
  {
    icon: TrendingUp,
    title: { es: "Copy pensado para vender", en: "Copy built to sell" },
    text: {
      es: "Cada anuncio incluye variantes de texto con técnicas reales de venta, no solo una descripción bonita.",
      en: "Every ad includes copy variants using real sales techniques, not just a pretty description.",
    },
  },
  {
    icon: ShieldCheck,
    title: { es: "Nunca se activa sin ti", en: "Never activates without you" },
    text: {
      es: "Toda campaña se crea en pausa. Tú revisas y decides cuándo empieza a correr.",
      en: "Every campaign is created paused. You review and decide when it starts running.",
    },
  },
  {
    icon: Users2,
    title: { es: "Seguimiento real", en: "Real tracking" },
    text: {
      es: "Alcance, clics e impresiones directo desde tu panel de WITERS, sin entrar a Ads Manager.",
      en: "Reach, clicks and impressions straight from your WITERS dashboard, no need to log into Ads Manager.",
    },
  },
];

function PorQue() {
  const { t } = useLanguage();
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">
            {t("Por qué", "Why")}
          </p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            WITERS
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2">
          {DIFERENCIADORES.map((d) => (
            <div key={d.title.es} className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wit-mist/50 text-wit-blue">
                <d.icon size={22} strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-base font-bold text-wit-ink">{t(d.title.es, d.title.en)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-wit-gray">
                  {t(d.text.es, d.text.en)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 5. CTA FINAL ---------------- */

function CtaFinal() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  const { t } = useLanguage();
  return (
    <section className="relative bg-white py-16 md:py-20">
      <div className="flex flex-col items-start gap-8 border-t border-wit-ink/10 px-5 pt-14 md:flex-row md:items-center md:justify-between md:px-[110px]">
        <h2 className="text-2xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
          {t("Tu próxima pieza puede ser", "Your next creative could be")}
          <br />
          {t("tu próxima", "your next")}{" "}
          <span className="italic text-wit-blue">{t("campaña", "campaign")}</span>.
        </h2>
        <Link
          to={signedIn ? "/panel" : "/registro"}
          onClick={() => trackCtaClick("Quiero pautar mis campañas (CTA final)")}
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-wit-ink/15 bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.08)] transition-all duration-200 hover:bg-wit-ink hover:text-white active:scale-[0.98]"
        >
          {t("Quiero pautar mis campañas", "I want to run my campaigns")}
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
