import { useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle as CommentIcon,
  MoreHorizontal,
  Send,
  ThumbsUp,
} from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import type { BrandLite, CampaignPiece } from "./types";

// A professional, close-enough preview — not a pixel-perfect clone of
// Meta's own UI. It exists so a client who has never opened Ads Manager
// can recognize "this is what my ad will look like" at a glance, built
// entirely from the real piece/copy/CTA already selected in the wizard.
function Media({ piece }: { piece: CampaignPiece }) {
  if (piece.format === "video" && piece.previewUrl) {
    return (
      <video
        src={piece.previewUrl}
        className="aspect-square w-full bg-wit-ink/5 object-cover"
        muted
        loop
        playsInline
        autoPlay
        aria-label={piece.title}
      />
    );
  }
  if (piece.previewUrl) {
    return (
      <img
        src={piece.previewUrl}
        alt={piece.title}
        className="aspect-square w-full bg-wit-ink/5 object-cover"
      />
    );
  }
  return <div className="aspect-square w-full bg-wit-mist/50" />;
}

function Avatar({ brand }: { brand: BrandLite }) {
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wit-blue text-xs font-extrabold text-white">
      {(brand.companyName ?? "W").slice(0, 1).toUpperCase()}
    </span>
  );
}

function InstagramPreview({
  brand,
  piece,
  message,
  ctaLabel,
}: {
  brand: BrandLite;
  piece: CampaignPiece;
  message: string;
  ctaLabel: string;
}) {
  const { t } = useLanguage();
  const handle = (brand.companyName ?? "witers").toLowerCase().replace(/\s+/g, "");
  return (
    <div className="overflow-hidden rounded-2xl border border-wit-ink/8 bg-white">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar brand={brand} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-wit-ink">{handle}</p>
          <p className="text-[11px] text-wit-gray">{t("Publicidad", "Sponsored")}</p>
        </div>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-wit-ink" />
      </div>
      <Media piece={piece} />
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart className="h-5 w-5 text-wit-ink" />
        <CommentIcon className="h-5 w-5 text-wit-ink" />
        <Send className="h-5 w-5 text-wit-ink" />
        <Bookmark className="ml-auto h-5 w-5 text-wit-ink" />
      </div>
      <p className="px-3 pb-1 pt-1.5 text-[13px] leading-snug text-wit-ink">
        <span className="font-bold">{handle}</span> <span className="line-clamp-2">{message}</span>
      </p>
      <div className="flex items-center justify-between border-t border-wit-ink/6 px-3 py-2.5">
        <span className="truncate text-xs text-wit-gray">
          {handle}.mx <span className="opacity-60">· {t("Publicidad", "Ad")}</span>
        </span>
        <span className="shrink-0 rounded-md bg-wit-mist/60 px-2 py-1 text-[11px] font-bold text-wit-ink">
          {ctaLabel}
        </span>
      </div>
    </div>
  );
}

function FacebookPreview({
  brand,
  piece,
  message,
  ctaLabel,
}: {
  brand: BrandLite;
  piece: CampaignPiece;
  message: string;
  ctaLabel: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-2xl border border-wit-ink/8 bg-white">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar brand={brand} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-wit-ink">
            {brand.companyName ?? "WITERS"}
          </p>
          <p className="text-[11px] text-wit-gray">{t("Publicidad · 🌐", "Sponsored · 🌐")}</p>
        </div>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-wit-ink" />
      </div>
      <p className="px-3 pb-2.5 text-[13px] leading-snug text-wit-ink">{message}</p>
      <Media piece={piece} />
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] uppercase text-wit-gray">
            {(brand.companyName ?? "witers.mx").toLowerCase()}
          </span>
          <span className="block truncate text-sm font-bold text-wit-ink">{piece.title}</span>
        </span>
        <span className="ml-2 shrink-0 rounded-md bg-wit-mist/70 px-3 py-2 text-xs font-bold text-wit-ink">
          {ctaLabel}
        </span>
      </div>
      <div className="flex items-center gap-4 border-t border-wit-ink/6 px-3 py-2 text-xs font-semibold text-wit-gray">
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="h-3.5 w-3.5" />
          {t("Me gusta", "Like")}
        </span>
        <span className="flex items-center gap-1.5">
          <CommentIcon className="h-3.5 w-3.5" />
          {t("Comentar", "Comment")}
        </span>
        <span className="flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {t("Compartir", "Share")}
        </span>
      </div>
    </div>
  );
}

export function MetaAdPreview({
  brand,
  piece,
  message,
  ctaLabel,
}: {
  brand: BrandLite;
  piece: CampaignPiece;
  message: string;
  ctaLabel: string;
}) {
  const { t } = useLanguage();
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  return (
    <div>
      <div className="mx-auto flex w-full max-w-[280px] rounded-full bg-wit-mist/50 p-1">
        {(["instagram", "facebook"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={`flex-1 rounded-full py-1.5 text-xs font-bold transition-colors ${
              platform === p ? "bg-white text-wit-ink shadow-sm" : "text-wit-gray"
            }`}
          >
            {p === "instagram" ? "Instagram" : "Facebook"}
          </button>
        ))}
      </div>
      <div className="mx-auto mt-4 max-w-[300px]">
        {platform === "instagram" ? (
          <InstagramPreview brand={brand} piece={piece} message={message} ctaLabel={ctaLabel} />
        ) : (
          <FacebookPreview brand={brand} piece={piece} message={message} ctaLabel={ctaLabel} />
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-wit-gray">
        {t(
          "Vista previa aproximada — el diseño final puede variar según el dispositivo.",
          "Approximate preview — the final design may vary by device.",
        )}
      </p>
    </div>
  );
}
