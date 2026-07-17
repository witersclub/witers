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
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/pauta")({
  head: () => ({
    meta: [
      { title: "Campañas de Meta Ads. WITERS" },
      {
        name: "description",
        content:
          "De la pieza a la campaña sin salir de WITERS: creamos tu creatividad con IA y la convertimos en una campaña real de Meta Ads, configurada y en pausa hasta que tú decidas activarla.",
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
  return (
    <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
      <div className="relative mx-auto max-w-3xl px-5 text-center md:px-[110px]">
        <span className="wit-rise inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue backdrop-blur-sm">
          Meta Ads · Campañas reales
        </span>
        <h1 className="wit-rise wit-rise-d1 mx-auto mt-7 max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tighter text-wit-ink md:text-7xl">
          De la pieza a la{" "}
          <span className="bg-[linear-gradient(135deg,#0047FF,#7d9aff)] bg-clip-text text-transparent">
            campaña
          </span>
          .
        </h1>
        <p className="wit-rise wit-rise-d2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-wit-gray">
          Creamos tu creatividad publicitaria con IA y la convertimos en una campaña real de Meta
          Ads — configurada en minutos, en pausa hasta que tú decidas encenderla.
        </p>
        <div className="wit-rise wit-rise-d2 mt-9 flex flex-col items-center gap-5">
          <Link
            to={signedIn ? "/panel" : "/registro"}
            className="group inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#2b57ff,#0047FF_55%,#1d2fa6)] px-8 py-4 text-base font-bold uppercase tracking-[0.06em] text-white shadow-[0_18px_40px_rgba(0,71,255,0.38)] transition-all duration-200 hover:shadow-[0_22px_48px_rgba(0,71,255,0.48)] active:scale-[0.98]"
          >
            Quiero pautar mis campañas
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
            Ver cómo trabajamos
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 2. CÓMO TRABAJAMOS ---------------- */

const PASOS = [
  {
    icon: Wand2,
    title: "Creamos tu pieza con IA",
    text: "Wit arma tu creatividad publicitaria — título, estilo y marca — en minutos, dentro de tu panel.",
  },
  {
    icon: Target,
    title: "Configuras tu campaña",
    text: "Objetivo, presupuesto, duración, ubicación, edad e intereses, en un wizard guiado — sin abrir Meta Ads Manager ni leer manuales.",
  },
  {
    icon: MapPinned,
    title: "La IA escribe el anuncio",
    text: "Tres variantes de texto pensadas para vender, no solo para verse bien. Las puedes editar antes de continuar.",
  },
  {
    icon: PauseCircle,
    title: "Se crea en pausa. Tú decides",
    text: "Ninguna campaña gasta un peso hasta que tú la actives desde tu panel, cuando estés listo.",
  },
];

function ComoTrabajamos() {
  return (
    <section id="como-trabajamos" className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">Cómo</p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            Trabajamos
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wit-gray">
            Todo pasa dentro de WITERS — la pieza y la campaña, en un solo lugar.
          </p>
        </div>

        <ol className="mx-auto mt-16 grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p, i) => (
            <li key={p.title} className="relative">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wit-mist/50 text-wit-blue">
                <p.icon size={26} strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-wit-blue">
                Paso {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-lg font-bold text-wit-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-wit-gray">{p.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- 3. RENDIMIENTOS REALES ---------------- */

const RENDIMIENTO_STATS = [
  { value: "$188,104 MXN", label: "En ventas generadas en 9 días" },
  { value: "9.9%", label: "De las ventas se invirtió en anuncios" },
  { value: "826", label: "Contactos nuevos generados" },
  { value: "$22.62 MXN", label: "Costo promedio por contacto nuevo" },
];

const RENDIMIENTO_SERVICIOS = [
  { servicio: "Suero + Hidrofacial", ventas: "$19,500", gasto: "$325", roas: "60.0×" },
  { servicio: "Botox en pareja", ventas: "$20,931", gasto: "$724", roas: "28.9×" },
  { servicio: "HIFU V", ventas: "$15,800", gasto: "$2,251", roas: "7.0×" },
  { servicio: "NCTF", ventas: "$12,131", gasto: "$2,516", roas: "4.8×" },
];

function Rendimientos() {
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
            Resultados reales
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tighter md:text-5xl">
            No prometemos. <span className="wit-underline text-[#5c85ff]">Mostramos.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/70">
            Datos reales de una campaña de un cliente de WITERS — un negocio de estética en Tijuana.
            Se omite el nombre por privacidad; las cifras son las que reportó Meta, sin editar.
            Período: 1 al 9 de mayo de 2026.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RENDIMIENTO_STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
            >
              <p className="font-wit-mono text-3xl font-semibold">{s.value}</p>
              <p className="mt-2 text-xs leading-snug text-white/60">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#5c85ff]/30 bg-[#0047FF]/10 p-6 text-center">
          <p className="text-base leading-relaxed">
            El servicio con mejor desempeño del período tuvo un{" "}
            <strong className="text-white">ROAS de 7.0×</strong> — $7 pesos vendidos por cada $1
            invertido en anuncios — con un crecimiento de{" "}
            <strong className="text-white">+300%</strong> respecto al período anterior.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
                <th className="px-5 py-3 font-semibold">Servicio</th>
                <th className="px-5 py-3 font-semibold">Ventas</th>
                <th className="px-5 py-3 font-semibold">Gasto en ads</th>
                <th className="px-5 py-3 font-semibold">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {RENDIMIENTO_SERVICIOS.map((r) => (
                <tr key={r.servicio} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-white/90">{r.servicio}</td>
                  <td className="px-5 py-3 text-white/70">{r.ventas}</td>
                  <td className="px-5 py-3 text-white/70">{r.gasto}</td>
                  <td className="px-5 py-3 font-semibold text-[#5c85ff]">{r.roas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-white/40">
          Los resultados varían según industria, ubicación, temporada y objetivos de cada negocio —
          estas cifras no son una garantía de resultados futuros, son el reporte real de un cliente
          durante el período indicado.
        </p>
      </div>
    </section>
  );
}

/* ---------------- 4. POR QUÉ WITERS ---------------- */

const DIFERENCIADORES = [
  {
    icon: Rocket,
    title: "Todo en un solo lugar",
    text: "La pieza y la campaña, sin subir archivos a otra plataforma ni copiar textos a mano.",
  },
  {
    icon: TrendingUp,
    title: "Copy pensado para vender",
    text: "Cada anuncio incluye variantes de texto con técnicas reales de venta, no solo una descripción bonita.",
  },
  {
    icon: ShieldCheck,
    title: "Nunca se activa sin ti",
    text: "Toda campaña se crea en pausa. Tú revisas y decides cuándo empieza a correr.",
  },
  {
    icon: Users2,
    title: "Seguimiento real",
    text: "Alcance, clics e impresiones directo desde tu panel de WITERS, sin entrar a Ads Manager.",
  },
];

function PorQue() {
  return (
    <section className="relative bg-white py-20 md:py-28">
      <div className="px-5 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-wit-gray">Por qué</p>
          <h2 className="wit-underline mt-1 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            WITERS
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2">
          {DIFERENCIADORES.map((d) => (
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

/* ---------------- 5. CTA FINAL ---------------- */

function CtaFinal() {
  const me = useMe();
  const signedIn = Boolean(me.data?.ok);
  return (
    <section className="relative bg-white py-16 md:py-20">
      <div className="flex flex-col items-start gap-8 border-t border-wit-ink/10 px-5 pt-14 md:flex-row md:items-center md:justify-between md:px-[110px]">
        <h2 className="text-2xl font-extrabold tracking-tighter text-wit-ink md:text-4xl">
          Tu próxima pieza puede ser
          <br />
          tu próxima <span className="italic text-wit-blue">campaña</span>.
        </h2>
        <Link
          to={signedIn ? "/panel" : "/registro"}
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-wit-ink/15 bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.08)] transition-all duration-200 hover:bg-wit-ink hover:text-white active:scale-[0.98]"
        >
          Quiero pautar mis campañas
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
