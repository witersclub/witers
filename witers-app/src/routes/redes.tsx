import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  GalleryHorizontal,
  Image as ImageIcon,
  Layers,
  Palette,
  ShieldCheck,
  Sparkles,
  Video as VideoIcon,
} from "lucide-react";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { SocialChannelsShowcase } from "../components/witers/social-mockups";
import { MEMBERSHIP_PLANS } from "../lib/membership-plans";
import { useMe } from "../lib/witers-client";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/redes")({
  head: () => ({
    meta: [
      { title: "Manejo de Redes Sociales. WITERS" },
      {
        name: "description",
        content:
          "El equipo de WITERS administra tus redes sociales para que tu marca se vea y se sienta igual en Instagram, TikTok y YouTube — contenido constante, diseñado para generar confianza y presencia digital.",
      },
    ],
  }),
  component: RedesLanding,
});

function RedesLanding() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />
      <Hero />
      <QueImplica />
      <TiposDeContenido />
      <Planes />
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
          {t("Manejo de redes sociales", "Social media management")}
        </span>
        <h1 className="wit-rise wit-rise-d1 mx-auto mt-6 max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-7xl">
          {t("Una marca.", "One brand.")}{" "}
          <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
            {t("Reconocible", "Recognizable")}
          </span>{" "}
          {t("en cada canal.", "on every channel.")}
        </h1>
        <p className="wit-rise wit-rise-d2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-wit-gray">
          {t(
            "WITERS administra tus redes sociales para que tu marca se vea y se sienta igual en Instagram, TikTok y YouTube — mismo estilo, mismo tono, el mismo reconocimiento en todos los canales donde tu cliente te encuentra.",
            "WITERS manages your social media so your brand looks and feels the same on Instagram, TikTok and YouTube — same style, same tone, the same recognition on every channel where your customer finds you.",
          )}
        </p>
        <div className="wit-rise wit-rise-d2 mt-9 flex flex-col items-center gap-5">
          <Link
            to={signedIn ? "/panel" : "/registro"}
            className="group inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-8 py-4 text-base font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
          >
            {t("Quiero unificar mis redes", "I want to unify my social media")}
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
          <a href="#que-implica" className="wit-navlink text-sm font-semibold text-wit-ink">
            {t("Ver qué incluye", "See what's included")}
          </a>
        </div>
      </div>

      <div className="wit-rise wit-rise-d2 mt-16 px-5 md:px-[110px]">
        <SocialChannelsShowcase />
      </div>
    </section>
  );
}

/* ---------------- 2. QUÉ IMPLICA ---------------- */

const PASOS = [
  {
    icon: Palette,
    title: { es: "Acondicionamos cada canal", en: "We set up every channel" },
    text: {
      es: "Foto de perfil, biografía, portadas, resaltados y colores — cada canal queda ajustado a tu identidad de marca, para que se reconozca al primer vistazo sin importar en cuál estés.",
      en: "Profile photo, bio, covers, highlights and colors — every channel gets set up to match your brand identity, so it's recognizable at first glance no matter which one you're on.",
    },
  },
  {
    icon: Calendar,
    title: { es: "Planeamos el contenido", en: "We plan the content" },
    text: {
      es: "Un calendario de publicación constante, definido según tu plan — nunca improvisado, siempre alineado a tu marca y a lo que tu audiencia necesita ver.",
      en: "A steady publishing calendar, defined by your plan — never improvised, always aligned with your brand and what your audience needs to see.",
    },
  },
  {
    icon: Sparkles,
    title: { es: "Creamos cada pieza", en: "We create every piece" },
    text: {
      es: "Imágenes, videos y carruseles diseñados con apoyo de IA y revisados por nuestro equipo — con el mismo estilo visual en todos los formatos.",
      en: "Images, videos and carousels designed with AI support and reviewed by our team — with the same visual style across every format.",
    },
  },
  {
    icon: ShieldCheck,
    title: { es: "Publicamos y damos seguimiento", en: "We publish and follow through" },
    text: {
      es: "Subimos el contenido y le damos seguimiento — para que la constancia y la unicidad de marca se mantengan mes tras mes, no solo el primer mes.",
      en: "We publish the content and follow through — so consistency and brand unity hold up month after month, not just the first one.",
    },
  },
];

function QueImplica() {
  const { t } = useLanguage();
  return (
    <section id="que-implica" className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">
            {t("Qué implica", "What it means")}
          </p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Un manejo completo de redes", "A complete social media service")}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wit-gray">
            {t(
              "No es solo subir contenido — es que cada canal comunique lo que tu marca es, de forma constante y reconocible.",
              "It's not just posting content — it's making sure every channel communicates exactly what your brand is, consistently and recognizably.",
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

/* ---------------- 3. TIPOS DE CONTENIDO ---------------- */

const CONTENIDOS = [
  {
    icon: ImageIcon,
    title: { es: "Imágenes de confiabilidad", en: "Trust-building images" },
    text: {
      es: "Piezas pensadas para que tu marca se vea sólida y profesional — el tipo de contenido que hace que un cliente nuevo decida confiar en ti.",
      en: "Creatives designed to make your brand look solid and professional — the kind of content that makes a new customer decide to trust you.",
    },
  },
  {
    icon: Layers,
    title: { es: "Presencia digital", en: "Digital presence" },
    text: {
      es: "Contenido constante que mantiene tu marca visible y activa, para que no desaparezcas del feed de tu audiencia entre solicitud y solicitud.",
      en: "Steady content that keeps your brand visible and active, so you never disappear from your audience's feed between requests.",
    },
  },
  {
    icon: VideoIcon,
    title: { es: "Videos orgánicos de alta producción", en: "High-production organic videos" },
    text: {
      es: "Video editado con nivel profesional — guion, ritmo y edición pensados para retener a quien lo ve, no solo para llenar el calendario.",
      en: "Professionally edited video — script, pacing and editing built to hold attention, not just to fill the calendar.",
    },
  },
  {
    icon: GalleryHorizontal,
    title: { es: "Carruseles informativos", en: "Informative carousels" },
    text: {
      es: "Formato ideal para explicar, educar o presentar tu producto o servicio a detalle — diseñado para que se guarde y se comparta.",
      en: "The ideal format to explain, educate, or showcase your product or service in detail — designed to be saved and shared.",
    },
  },
];

function TiposDeContenido() {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden bg-wit-navy py-20 text-white md:py-28">
      <div className="relative px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/60">
            {t("Contenido", "Content")}
          </p>
          <h2 className="mt-1 text-4xl font-extrabold tracking-tighter md:text-5xl">
            {t("Cuatro tipos de contenido,", "Four kinds of content,")}{" "}
            <span className="wit-underline text-[#5c85ff]">
              {t("un mismo objetivo", "one same goal")}
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
          {CONTENIDOS.map((c) => (
            <div
              key={c.title.es}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/[0.08]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0047FF]/20 text-[#7d9aff]">
                <c.icon size={22} strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-base font-bold">{t(c.title.es, c.title.en)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {t(c.text.es, c.text.en)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 4. PLANES ---------------- */

function Planes() {
  const { t } = useLanguage();
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">
            {t("Constancia", "Consistency")}
          </p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Contenido cada semana", "Content every week")}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wit-gray">
            {t(
              "Publicamos de forma semanal, repartiendo el cupo mensual de tu membresía a lo largo del mes — nunca todo de golpe, nunca en silencio.",
              "We publish weekly, spreading your membership's monthly quota across the month — never all at once, never silent for too long.",
            )}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {MEMBERSHIP_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl border p-7 ${
                plan.destacada
                  ? "border-wit-blue/30 bg-wit-mist/25 shadow-[0_20px_50px_rgba(0,71,255,0.12)]"
                  : "border-wit-ink/10 bg-white"
              }`}
            >
              {plan.destacada ? (
                <span className="absolute -top-3 left-7 rounded-full bg-wit-blue px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  {t("Más elegido", "Most popular")}
                </span>
              ) : null}
              <p className="text-lg font-extrabold text-wit-ink">{plan.nombre}</p>
              <p className="mt-1 text-sm text-wit-gray">{plan.tagline}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-wit-ink">
                <li className="flex items-baseline gap-2">
                  <span className="font-extrabold text-wit-blue">{plan.requestsQuota}</span>
                  {t("piezas de diseño al mes", "design pieces per month")}
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-extrabold text-wit-blue">
                    {plan.carouselRequestsQuota > 0 ? plan.carouselRequestsQuota : "—"}
                  </span>
                  {plan.carouselRequestsQuota > 0
                    ? t("carruseles al mes", "carousels per month")
                    : t("sin carruseles en este plan", "no carousels on this plan")}
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-extrabold text-wit-blue">
                    {plan.videoRequestsQuota > 0 ? plan.videoRequestsQuota : "—"}
                  </span>
                  {plan.videoRequestsQuota > 0
                    ? t("videos al mes", "videos per month")
                    : t("sin video en este plan", "no video on this plan")}
                </li>
              </ul>
              <a
                href="/#membresia"
                className="wit-navlink mt-6 inline-block text-sm font-bold text-wit-blue"
              >
                {t("Ver detalles del plan →", "See plan details →")}
              </a>
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
          {t("Que te reconozcan", "Get recognized")}
          <br />
          {t("en cada", "on every")}{" "}
          <span className="italic text-wit-blue">{t("canal", "channel")}</span>.
        </h2>
        <Link
          to={signedIn ? "/panel" : "/registro"}
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-wit-ink/15 bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.08)] transition-all duration-200 hover:bg-wit-ink hover:text-white active:scale-[0.98]"
        >
          {t("Quiero unificar mis redes", "I want to unify my social media")}
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
