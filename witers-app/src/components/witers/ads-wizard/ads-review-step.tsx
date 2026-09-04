import { getAdsServiceRate } from "../../../lib/ads-service-fee";
import { useLanguage } from "../../../lib/i18n";
import type { CampaignPiece, WizardStepId } from "./types";

function ReviewRow({
  icon,
  label,
  value,
  sub,
  onEdit,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  onEdit: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-3 py-3.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wit-mist/50 text-sm">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-wit-gray">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-wit-ink">{value}</p>
        {sub ? <p className="text-xs text-wit-gray">{sub}</p> : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-0.5 shrink-0 text-xs font-bold text-wit-blue"
      >
        {t("Editar", "Edit")}
      </button>
    </div>
  );
}

export function AdsReviewStep({
  piece,
  objectiveLabel,
  destinationLabel,
  destinationSub,
  audienceLabel,
  dailyBudgetMxn,
  durationDays,
  message,
  activateImmediately,
  onActivateImmediatelyChange,
  onEditStep,
}: {
  piece: CampaignPiece;
  objectiveLabel: string;
  destinationLabel: string;
  destinationSub: string | null;
  audienceLabel: string;
  dailyBudgetMxn: number;
  durationDays: number;
  message: string;
  activateImmediately: boolean;
  onActivateImmediatelyChange: (value: boolean) => void;
  onEditStep: (step: WizardStepId) => void;
}) {
  const { t } = useLanguage();
  const maxInvestment = dailyBudgetMxn * durationDays;
  const rate = getAdsServiceRate();
  const feeMax = Math.round(maxInvestment * rate);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Revisión", "Review")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("Tu campaña está lista", "Your campaign is ready")}
      </h2>

      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-wit-ink/8 p-3.5">
        {piece.previewUrl && piece.format !== "video" ? (
          <img
            src={piece.previewUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-wit-mist/50 text-2xl">
            🖼️
          </span>
        )}
        <div className="min-w-0">
          <b className="block truncate text-sm text-wit-ink">{piece.title}</b>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-wit-gray">{message}</p>
        </div>
      </div>

      <div className="mt-2 divide-y divide-wit-ink/7 rounded-2xl bg-wit-mist/20 px-4">
        <ReviewRow
          icon="💬"
          label={t("Objetivo", "Objective")}
          value={objectiveLabel}
          onEdit={() => onEditStep("objetivo")}
        />
        <ReviewRow
          icon="📍"
          label={t("Destino", "Destination")}
          value={destinationLabel}
          sub={destinationSub ?? undefined}
          onEdit={() => onEditStep("destino")}
        />
        <ReviewRow
          icon="🎯"
          label={t("Audiencia", "Audience")}
          value={audienceLabel}
          onEdit={() => onEditStep("audiencia")}
        />
        <ReviewRow
          icon="💰"
          label={t("Presupuesto", "Budget")}
          value={t(
            `$${dailyBudgetMxn.toLocaleString()} MXN / día`,
            `$${dailyBudgetMxn.toLocaleString()} MXN / day`,
          )}
          onEdit={() => onEditStep("presupuesto")}
        />
        <ReviewRow
          icon="📅"
          label={t("Duración", "Duration")}
          value={t(`${durationDays} días`, `${durationDays} days`)}
          onEdit={() => onEditStep("duracion")}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-wit-mist/35 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-wit-ink">
            {t("Inversión máxima en Meta", "Maximum investment on Meta")}
          </span>
          <b className="text-lg text-wit-blue">${maxInvestment.toLocaleString()} MXN</b>
        </div>
        <div className="mt-2.5 flex items-baseline justify-between border-t border-wit-ink/8 pt-2.5">
          <span className="text-xs font-semibold text-wit-gray">
            {t(
              `Servicio Ads · ${Math.round(rate * 100)}%`,
              `Ads Service · ${Math.round(rate * 100)}%`,
            )}
          </span>
          <span className="text-xs font-bold text-wit-ink">
            {t(`Hasta $${feeMax.toLocaleString()} MXN`, `Up to $${feeMax.toLocaleString()} MXN`)}
          </span>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-wit-gray">
          {t(
            "El Servicio Ads se calcula únicamente sobre la inversión que Meta realmente utilice. Meta y WITERS se facturan por separado.",
            "The Ads Service is calculated only on what Meta actually spends. Meta and WITERS are billed separately.",
          )}
        </p>
      </div>

      <label className="mt-4 flex items-start gap-2.5 rounded-2xl border border-wit-ink/10 p-3.5 text-sm">
        <input
          type="checkbox"
          checked={activateImmediately}
          onChange={(event) => onActivateImmediatelyChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-wit-blue"
        />
        <span>
          <b className="block text-wit-ink">
            {t("Activar de inmediato al crear", "Activate immediately on creation")}
          </b>
          <span className="mt-0.5 block text-xs leading-relaxed text-wit-gray">
            {activateImmediately
              ? t(
                  "La campaña empezará a mostrarse y a gastar en cuanto la crees, sin revisión previa.",
                  "The campaign will start showing and spending as soon as you create it, with no prior review.",
                )
              : t(
                  "Se crea pausada; tú la activas manualmente en Meta cuando la hayas revisado.",
                  "It's created paused; you activate it manually on Meta once you've reviewed it.",
                )}
          </span>
        </span>
      </label>
    </div>
  );
}
