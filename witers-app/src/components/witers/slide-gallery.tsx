// Swipeable image viewer — chevrons + dot indicators, chevrons/dots only
// rendered when there's more than one image. Extracted from panel.tsx's
// "Mis solicitudes" lightbox (Inicio) so calendar-planning.tsx's EntryDetail
// can show the same delivered-carousel gallery without duplicating the
// paging logic. Owns its own current-index state — pass a `key` that
// changes with the gallery's identity (e.g. the request/entry id) so
// switching to a different piece remounts it back to the first image
// instead of carrying over a stale index.
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useLanguage } from "../../lib/i18n";

export function SlideGallery({
  images,
  alt,
  imageClassName,
  className,
}: {
  images: string[];
  alt: string;
  imageClassName?: string;
  // Root wrapper class — defaults to shrink-wrapping around the image
  // (natural sizing, for a lightbox). Pass e.g. "relative h-full w-full"
  // to stretch it to fill a fixed-size ancestor instead (for a grid cell).
  className?: string;
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className={className ?? "relative"}>
      <img
        src={images[index]}
        alt={alt}
        className={imageClassName ?? "h-full w-full object-cover"}
      />
      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
            aria-label={t("Lámina anterior", "Previous slide")}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.25)] hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % images.length)}
            aria-label={t("Siguiente lámina", "Next slide")}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-wit-ink shadow-[0_10px_30px_rgba(5,13,40,0.25)] hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
