import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import { MetaAdPreview } from "./meta-ad-preview";
import type { BrandLite, CampaignPiece, Objective } from "./types";

// "Mejorar para pauta con Wit" — /api/generate-ad-copy (generateAdCopy in
// ad-copy.server.ts) already existed, built specifically for this screen
// per its own comments, but nothing called it before this step. Never
// invents copy client-side; every variant comes back from that real
// OpenAI call.
export function AdsCreativeStep({
  piece,
  brand,
  objective,
  message,
  onMessageChange,
  ctaLabel,
  audienceSummary,
}: {
  piece: CampaignPiece;
  brand: BrandLite;
  objective: Objective;
  message: string;
  onMessageChange: (value: string) => void;
  ctaLabel: string;
  audienceSummary: string | null;
}) {
  const { t } = useLanguage();
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [variants, setVariants] = useState<string[] | null>(null);
  const [showingOptimized, setShowingOptimized] = useState(false);
  const original = piece.caption?.trim() || piece.title;

  async function improveWithWit() {
    if (improving) return;
    setImproving(true);
    setImproveError(null);
    try {
      const res = await fetch("/api/generate-ad-copy", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: piece.title,
          pieceBrief: piece.caption ?? undefined,
          audience: audienceSummary ?? undefined,
          companyName: brand.companyName ?? undefined,
          objective,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        messages?: [string, string, string];
      };
      if (!res.ok || !data.ok || !data.messages) {
        setImproveError(
          t(
            "No pudimos generar una versión optimizada. Intenta de nuevo.",
            "We couldn't generate an optimized version. Try again.",
          ),
        );
        return;
      }
      setVariants(data.messages);
      onMessageChange(data.messages[0]);
      setShowingOptimized(true);
    } finally {
      setImproving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Creativo", "Creative")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("Así se verá tu anuncio", "Here's how your ad will look")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-wit-gray">
        {t(
          "Previsualiza y edita el contenido de tu anuncio.",
          "Preview and edit your ad's content.",
        )}
      </p>

      <div className="mt-6">
        <MetaAdPreview brand={brand} piece={piece} message={message} ctaLabel={ctaLabel} />
      </div>

      <div className="mt-7">
        <span className="text-sm font-extrabold text-wit-ink">
          {t("Texto del anuncio", "Ad copy")}
        </span>
        {variants ? (
          <div className="mt-2 flex w-full rounded-full bg-wit-mist/50 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setShowingOptimized(false);
                onMessageChange(original);
              }}
              className={`flex-1 rounded-full py-1.5 ${!showingOptimized ? "bg-white text-wit-ink shadow-sm" : "text-wit-gray"}`}
            >
              {t("Original", "Original")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowingOptimized(true);
                onMessageChange(variants[0]);
              }}
              className={`flex-1 rounded-full py-1.5 ${showingOptimized ? "bg-white text-wit-ink shadow-sm" : "text-wit-gray"}`}
            >
              {t("Optimizado por Wit", "Optimized by Wit")}
            </button>
          </div>
        ) : null}
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          rows={4}
          maxLength={500}
          className="mt-2.5 w-full resize-none rounded-2xl border border-wit-ink/10 p-3 text-sm outline-none focus:border-wit-blue"
        />
        {variants && showingOptimized ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variants.map((variant, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onMessageChange(variant)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                  message === variant
                    ? "border-wit-blue text-wit-blue"
                    : "border-wit-ink/10 text-wit-gray"
                }`}
              >
                {t(`Versión ${index + 1}`, `Version ${index + 1}`)}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void improveWithWit()}
          disabled={improving}
          className="mt-3 flex items-center gap-1.5 text-sm font-bold text-wit-blue disabled:opacity-50"
        >
          {improving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {improving
            ? t("Wit está escribiendo...", "Wit is writing...")
            : t("Mejorar para pauta con Wit", "Improve for ads with Wit")}
        </button>
        {improveError ? (
          <p className="mt-1.5 text-xs text-red-600" role="alert">
            {improveError}
          </p>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl bg-wit-mist/35 p-3.5">
        <span className="text-xs font-bold text-wit-gray">
          {t("CTA (automático)", "CTA (automatic)")}
        </span>
        <p className="mt-1 text-sm font-bold text-wit-ink">{ctaLabel}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-wit-gray">
          {t(
            "Meta lo elige según tu objetivo y destino — todavía no es editable.",
            "Meta picks this based on your objective and destination — not editable yet.",
          )}
        </p>
      </div>
    </div>
  );
}
