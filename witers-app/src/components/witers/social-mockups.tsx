// Faithful-feeling mockups of one brand's channels — Instagram, Facebook,
// TikTok and YouTube — all carrying the exact same visual identity (avatar
// mark, color palette, tone of voice) so the "unicidad de marca" claim on
// /redes is something you can see, not just read. Reuses the same fictional
// example client ("Boutique Alma") and gradient palette already used in
// panel-preview-showcase.tsx and campaign-journey-scroller.tsx, so the whole
// site's mockups feel like one consistent story instead of several
// unrelated invented brands.
import type { ReactNode } from "react";
import {
  Bookmark,
  Grid3x3,
  Heart,
  Home,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  PlusSquare,
  Search,
  Share2,
  ThumbsUp,
  UserCircle2,
} from "lucide-react";

import { useLanguage } from "../../lib/i18n";

const BRAND_GRADIENTS = [
  "linear-gradient(135deg,#C97B84,#8a4f57)",
  "linear-gradient(135deg,#B08D57,#6e5730)",
  "linear-gradient(135deg,#2B2320,#544738)",
];

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: BRAND_GRADIENTS[0],
      }}
    >
      A
    </span>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-[232px] rounded-[2.1rem] border-[7px] border-wit-ink bg-wit-ink shadow-[0_35px_80px_rgba(5,13,40,0.3)] sm:w-[248px]">
      <div className="relative h-[480px] overflow-hidden rounded-[1.5rem] bg-white sm:h-[510px]">
        <div className="absolute left-1/2 top-0 z-30 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-wit-ink" />
        {children}
      </div>
    </div>
  );
}

/* ---------------- Instagram ---------------- */

function InstagramScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-white pt-7 text-wit-ink">
      <div className="flex items-center justify-between px-3 pb-2 pt-1.5">
        <p className="text-[13px] font-extrabold tracking-tight">boutiquealma</p>
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </div>

      <div className="flex items-center gap-2.5 px-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full p-[2px]"
          style={{ background: BRAND_GRADIENTS[0] }}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-base font-extrabold text-[#8a4f57]">
            A
          </span>
        </span>
        <div className="flex flex-1 justify-around text-center">
          <div className="min-w-0 px-0.5">
            <p className="text-[11px] font-extrabold leading-none">248</p>
            <p className="mt-1 break-words text-[7px] leading-tight text-wit-gray">
              {t("publicaciones", "posts")}
            </p>
          </div>
          <div className="min-w-0 px-0.5">
            <p className="text-[11px] font-extrabold leading-none">12.4K</p>
            <p className="mt-1 break-words text-[7px] leading-tight text-wit-gray">
              {t("seguidores", "followers")}
            </p>
          </div>
          <div className="min-w-0 px-0.5">
            <p className="text-[11px] font-extrabold leading-none">312</p>
            <p className="mt-1 break-words text-[7px] leading-tight text-wit-gray">
              {t("seguidos", "following")}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-2.5">
        <p className="text-[10px] font-bold leading-tight">Boutique Alma</p>
        <p className="text-[9px] leading-snug text-wit-gray">
          {t(
            "Moda con estilo ✨ Piezas hechas para durar. Envíos a todo México 🚚",
            "Fashion with style ✨ Pieces made to last. Shipping all over Mexico 🚚",
          )}
        </p>
      </div>

      <div className="flex gap-3 px-3 pt-3">
        {[BRAND_GRADIENTS[0], BRAND_GRADIENTS[1], BRAND_GRADIENTS[2]].map((g, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full p-[1.5px]"
              style={{ background: g }}
            >
              <span className="h-full w-full rounded-full bg-wit-mist/50" />
            </span>
            <span className="text-[6.5px] text-wit-gray">{["Nuevo", "Verano", "Clientas"][i]}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-10 border-t border-wit-ink/10 pt-2">
        <Grid3x3 className="h-4 w-4 text-wit-ink" strokeWidth={1.8} />
        <UserCircle2 className="h-4 w-4 text-wit-ink/30" strokeWidth={1.8} />
      </div>

      <div className="grid flex-1 grid-cols-3 gap-[1.5px] overflow-hidden bg-white pb-8 pt-[1.5px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ background: BRAND_GRADIENTS[i % BRAND_GRADIENTS.length] }} />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-wit-ink/10 bg-white/95 py-2.5 backdrop-blur">
        <Home className="h-4 w-4 text-wit-ink" strokeWidth={2} />
        <Search className="h-4 w-4 text-wit-ink/40" strokeWidth={2} />
        <PlusSquare className="h-4 w-4 text-wit-ink/40" strokeWidth={2} />
        <BrandMark size={16} />
      </div>
    </div>
  );
}

/* ---------------- Facebook ---------------- */

function FacebookScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col bg-white text-wit-ink">
      <div className="relative h-[88px]" style={{ background: BRAND_GRADIENTS[1] }}>
        <span
          className="absolute -bottom-6 left-3 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white p-[2px]"
          style={{ background: BRAND_GRADIENTS[0] }}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-base font-extrabold text-[#8a4f57]">
            A
          </span>
        </span>
      </div>

      <div className="px-3 pb-2 pt-8">
        <p className="text-[13px] font-extrabold leading-tight">Boutique Alma</p>
        <p className="text-[8px] text-wit-gray">
          {t("Tienda de ropa · Página", "Clothing store · Page")}
        </p>
        <p className="mt-0.5 text-[8px] text-wit-gray">
          {t("12.4K me gusta · 12.8K seguidores", "12.4K likes · 12.8K followers")}
        </p>

        <div className="mt-2.5 flex gap-1.5">
          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#1877F2] py-1.5 text-[9px] font-bold text-white">
            <ThumbsUp className="h-3 w-3" strokeWidth={2.4} />
            {t("Me gusta", "Like")}
          </span>
          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-wit-mist/60 py-1.5 text-[9px] font-bold text-wit-ink">
            <MessageCircle className="h-3 w-3" strokeWidth={2.4} />
            {t("Mensaje", "Message")}
          </span>
        </div>
      </div>

      <div className="flex gap-4 border-y border-wit-ink/10 px-3 py-2 text-[8.5px] font-bold text-wit-gray">
        <span className="border-b-2 border-[#1877F2] pb-1.5 text-[#1877F2]">
          {t("Publicaciones", "Posts")}
        </span>
        <span>{t("Info", "About")}</span>
        <span>{t("Fotos", "Photos")}</span>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BrandMark size={22} />
          <div className="leading-tight">
            <p className="text-[9px] font-bold">Boutique Alma</p>
            <p className="text-[7px] text-wit-gray">{t("hace 2 h · 🌐", "2h · 🌐")}</p>
          </div>
        </div>
        <p className="mt-1.5 text-[8.5px] leading-snug">
          {t(
            "Nueva colección de verano ya disponible ☀️👗",
            "New summer collection now available ☀️👗",
          )}
        </p>
        <div
          className="mt-2 h-[108px] w-full rounded-lg"
          style={{ background: BRAND_GRADIENTS[0] }}
        />
        <div className="mt-2 flex items-center justify-between text-[8px] text-wit-gray">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-[#1877F2]" strokeWidth={2.2} />
            428
          </span>
          <span>86 {t("comentarios", "comments")}</span>
          <span>32 {t("veces compartido", "shares")}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- TikTok ---------------- */

function TikTokScreen() {
  const { t } = useLanguage();
  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden pt-7 text-white"
      style={{ background: BRAND_GRADIENTS[2] }}
    >
      <div className="flex items-center justify-center gap-5 px-3 text-[11px] font-semibold text-white/60">
        <span>{t("Siguiendo", "Following")}</span>
        <span className="text-white">{t("Para ti", "For You")}</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <BrandMark size={90} />
      </div>

      <div className="relative z-10 flex items-end justify-between gap-2 px-3 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold">@boutiquealma</p>
          <p className="mt-1 text-[9px] leading-snug text-white/90">
            {t(
              "Así armamos el look de temporada 👗✨ #ModaMX #BoutiqueAlma",
              "Here's how we style the seasonal look 👗✨ #Fashion #BoutiqueAlma",
            )}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[8px] text-white/80">
            <Music2 className="h-2.5 w-2.5" strokeWidth={2} />
            <span>{t("audio original — Boutique Alma", "original audio — Boutique Alma")}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3.5">
          <BrandMark size={30} />
          <div className="flex flex-col items-center gap-0.5">
            <Heart className="h-5 w-5" fill="white" strokeWidth={0} />
            <span className="text-[8px] font-semibold">3,204</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
            <span className="text-[8px] font-semibold">186</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Bookmark className="h-5 w-5" strokeWidth={2} />
            <span className="text-[8px] font-semibold">94</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Share2 className="h-5 w-5" strokeWidth={2} />
            <span className="text-[8px] font-semibold">{t("Compartir", "Share")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- YouTube (TV) ---------------- */

function TvFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[360px] rounded-2xl border-[7px] border-wit-ink bg-wit-ink p-1.5 shadow-[0_35px_80px_rgba(5,13,40,0.3)] sm:w-[400px]">
        <div className="aspect-video overflow-hidden rounded-lg bg-black">{children}</div>
      </div>
      <div
        className="h-3 w-20 bg-wit-ink"
        style={{ clipPath: "polygon(15% 0,85% 0,100% 100%,0 100%)" }}
      />
      <div className="h-1.5 w-32 rounded-full bg-wit-ink/70" />
    </div>
  );
}

function YouTubeScreen() {
  const { t } = useLanguage();
  return (
    <div className="relative flex h-full flex-col justify-between text-white">
      <div className="absolute inset-0" style={{ background: BRAND_GRADIENTS[1] }} />
      <div className="relative z-10 flex items-center gap-2 px-3 pt-2.5">
        <span className="rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-bold tracking-wide">
          EN VIVO
        </span>
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/35">
          <Play className="h-5 w-5 fill-white text-white" strokeWidth={0} />
        </span>
      </div>
      <div className="relative z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        <div className="flex items-center gap-2">
          <BrandMark size={22} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold">
              {t("Boutique Alma — Colección de verano", "Boutique Alma — Summer collection")}
            </p>
            <p className="text-[8px] text-white/70">
              {t("Boutique Alma · 8.1K suscriptores", "Boutique Alma · 8.1K subscribers")}
            </p>
          </div>
          <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-white/85" strokeWidth={2} />
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full w-2/3 bg-white" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Showcase row ---------------- */

export function SocialChannelsShowcase() {
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-12">
      <div className="flex flex-col items-center gap-3">
        <PhoneFrame>
          <InstagramScreen />
        </PhoneFrame>
        <p className="text-sm font-bold text-wit-ink">Instagram</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <PhoneFrame>
          <FacebookScreen />
        </PhoneFrame>
        <p className="text-sm font-bold text-wit-ink">Facebook</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <PhoneFrame>
          <TikTokScreen />
        </PhoneFrame>
        <p className="text-sm font-bold text-wit-ink">TikTok</p>
      </div>
      <div className="flex flex-col items-center gap-3 self-center">
        <TvFrame>
          <YouTubeScreen />
        </TvFrame>
        <p className="text-sm font-bold text-wit-ink">YouTube</p>
      </div>
    </div>
  );
}
