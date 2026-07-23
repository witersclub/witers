// A 3D-tilted "Meta Ads dashboard" preview card — built with the site's own
// design system (not a raster image), so it never shows a mismatched dark
// background box against a white section and its text is always crisp,
// real, and never garbled the way an AI-generated mockup image can be.
// Numbers match the real (anonymized) client case study already shown in
// /pauta's "Resultados reales" section, so the whole site tells one
// consistent story instead of two different sets of figures.
import { Infinity as InfinityIcon } from "lucide-react";

import { useLanguage } from "../../lib/i18n";

export function MetaAdsDashboardCard({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
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
              <p className="mt-1 text-[10px] text-wit-gray">
                {t("Rendimiento de campañas", "Campaign performance")}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-wit-mist/60 px-2.5 py-1 text-[10px] font-semibold text-wit-gray">
            {t("1–9 may", "May 1–9")}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-wit-mist/40 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">
              {t("Inversión", "Spend")}
            </p>
            <p className="mt-1 text-base font-extrabold text-wit-ink">$18,680</p>
          </div>
          <div className="rounded-xl bg-wit-mist/40 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">
              {t("Contactos", "Leads")}
            </p>
            <p className="mt-1 text-base font-extrabold text-wit-ink">826</p>
          </div>
          <div className="rounded-xl bg-wit-mist/40 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-wit-gray">
              {t("Costo/result.", "Cost/result.")}
            </p>
            <p className="mt-1 text-base font-extrabold text-wit-ink">$22.62</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[linear-gradient(135deg,#0047FF,#1d2fa6)] p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/80">
              {t("Rendimiento general", "Overall performance")}
            </p>
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
          <p className="mt-1 text-[11px] font-semibold text-white/85">
            {t("+300% vs. período anterior", "+300% vs. previous period")}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-wit-ink/10 pt-3 text-xs text-wit-gray">
          <span>{t("5 campañas activas", "5 active campaigns")}</span>
          <span className="font-semibold text-wit-blue">{t("Ver todas →", "View all →")}</span>
        </div>
      </div>
    </div>
  );
}

// A small iPhone/WhatsApp mockup showing a real customer message landing
// after clicking an ad — the "lo que está sucediendo" half of the pairing
// with MetaAdsDashboardCard's "lo técnico" half. Meant to sit layered on
// top of that card, not standalone, so it's intentionally compact.
export function WhatsAppPhoneMockup({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div className={`[perspective:1200px] ${className}`}>
      <div className="w-[212px] rounded-[2.1rem] border-[6px] border-wit-ink bg-wit-ink shadow-[0_35px_70px_rgba(5,13,40,0.4)] transition-transform duration-500 [transform:rotateY(10deg)_rotateX(-4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-[#e5ddd5]">
          <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-wit-ink" />

          <div className="flex items-center gap-2 bg-[#128C7E] px-3 pb-2 pt-5 text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-[10px] font-bold">
              CM
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold">
                {t("Cliente potencial", "Potential customer")}
              </p>
              <p className="text-[8px] text-white/75">{t("en línea", "online")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 px-2 py-2.5">
            <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-2 py-1.5 text-[9px] leading-snug text-wit-ink shadow-sm">
              {t(
                "Hola! Vi su anuncio en Instagram 👋 ¿todavía tienen disponibilidad?",
                "Hi! I saw your ad on Instagram 👋 do you still have availability?",
              )}
            </div>
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-2 py-1.5 text-[9px] leading-snug text-wit-ink shadow-sm">
              {t(
                "¡Hola! Sí, claro 😊 ¿qué día te gustaría?",
                "Hi! Yes, of course 😊 what day would you like?",
              )}
            </div>
            <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-2 py-1.5 text-[9px] leading-snug text-wit-ink shadow-sm">
              {t("Perfecto, quiero agendar 🙌", "Perfect, I'd like to schedule 🙌")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
