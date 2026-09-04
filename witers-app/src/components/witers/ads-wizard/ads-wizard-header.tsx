import { ChevronLeft, X } from "lucide-react";

import { useLanguage } from "../../../lib/i18n";
import { WIZARD_STEP_ORDER, type WizardStepId } from "./types";

// Real, user-facing decision steps only — "preparacion" can auto-skip and
// "creando" is a transient result screen, neither should count toward
// "Paso X de 7" or the thin progress bar.
const COUNTED_STEPS: WizardStepId[] = WIZARD_STEP_ORDER.filter(
  (id) => id !== "preparacion" && id !== "creando",
);

// Replaces the old 4-dot/4-check row — with 7 steps that would have
// turned into visual noise (exactly what the client asked to avoid).
// "Paso X de 7" + a thin bar reads as light at any step count.
export function AdsWizardHeader({
  step,
  onBack,
  onClose,
  canGoBack,
}: {
  step: WizardStepId;
  onBack: () => void;
  onClose: () => void;
  canGoBack: boolean;
}) {
  const { t } = useLanguage();
  const index = COUNTED_STEPS.indexOf(step);
  const total = COUNTED_STEPS.length;
  const progress = index >= 0 ? ((index + 1) / total) * 100 : 100;

  return (
    <div className="relative shrink-0 border-b border-wit-ink/5 px-5 pb-4 pt-[calc(1.1rem+env(safe-area-inset-top))] md:px-7 md:pt-6">
      <span className="absolute left-1/2 top-[calc(.45rem+env(safe-area-inset-top))] h-1.5 w-11 -translate-x-1/2 rounded-full bg-wit-ink/15 md:hidden" />
      <div className="flex items-center justify-between gap-3">
        {canGoBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wit-ink hover:bg-wit-mist/50"
            aria-label={t("Paso anterior", "Previous step")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        )}
        {index >= 0 ? (
          <span className="text-xs font-bold text-wit-gray">
            {t(`Paso ${index + 1} de ${total}`, `Step ${index + 1} of ${total}`)}
          </span>
        ) : (
          <span className="h-4" />
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wit-ink hover:bg-wit-mist/50"
          aria-label={t("Cerrar", "Close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {index >= 0 ? (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-wit-mist/60">
          <div
            className="h-full rounded-full bg-wit-blue transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
