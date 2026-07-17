// A 3D-tilted "Meta Ads dashboard" preview card — built with the site's own
// design system (not a raster image), so it never shows a mismatched dark
// background box against a white section and its text is always crisp,
// real, and never garbled the way an AI-generated mockup image can be.
// Numbers match the real (anonymized) client case study already shown in
// /pauta's "Resultados reales" section, so the whole site tells one
// consistent story instead of two different sets of figures.
import { Infinity as InfinityIcon } from "lucide-react";

export function MetaAdsDashboardCard({ className = "" }: { className?: string }) {
  return (
    <div className={`[perspective:1200px] ${className}`}>
      <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-[0_50px_100px_rgba(5,13,40,0.28)] ring-1 ring-wit-ink/5 transition-transform duration-500 [transform:rotateY(-10deg)_rotateX(4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wit-blue/10 text-wit-blue">
              <InfinityIcon size={18} strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-sm font-bold leading-none text-wit-ink">Meta Ads</p>
              <p className="mt-1 text-[10px] text-wit-gray">Rendimiento de campañas</p>
            </div>
          </div>
          <span className="rounded-full bg-wit-mist/60 px-2.5 py-1 text-[10px] font-semibold text-wit-gray">
            1–9 may
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-wit-mist/40 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">Inversión</p>
            <p className="mt-1 text-base font-extrabold text-wit-ink">$18,680</p>
          </div>
          <div className="rounded-xl bg-wit-mist/40 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">Contactos</p>
            <p className="mt-1 text-base font-extrabold text-wit-ink">826</p>
          </div>
          <div className="rounded-xl bg-wit-mist/40 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">
              Costo/result.
            </p>
            <p className="mt-1 text-base font-extrabold text-wit-ink">$22.62</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[linear-gradient(135deg,#0047FF,#1d2fa6)] p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/80">Rendimiento general</p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
              ROAS 7.0×
            </span>
          </div>
          <svg viewBox="0 0 200 60" className="mt-2 h-14 w-full" aria-hidden="true">
            <polyline
              fill="none"
              stroke="white"
              strokeOpacity="0.9"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,50 30,42 60,44 90,30 120,32 150,15 180,10 200,6"
            />
          </svg>
          <p className="mt-1 text-[11px] font-semibold text-white/85">+300% vs. período anterior</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-wit-ink/10 pt-3 text-xs text-wit-gray">
          <span>5 campañas activas</span>
          <span className="font-semibold text-wit-blue">Ver todas →</span>
        </div>
      </div>
    </div>
  );
}
