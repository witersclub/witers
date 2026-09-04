import { useState } from "react";

import { useLanguage } from "../../../lib/i18n";

const PRESETS = [100, 200, 300];
const RECOMMENDED = 200;

export function AdsBudgetStep({
  dailyBudgetMxn,
  onChange,
}: {
  dailyBudgetMxn: number;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  const [custom, setCustom] = useState(!PRESETS.includes(dailyBudgetMxn));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-wit-blue">
        {t("Presupuesto", "Budget")}
      </p>
      <h2 id="campaign-flow-title" className="mt-2 text-2xl font-extrabold text-wit-ink">
        {t("¿Cuánto quieres invertir al día?", "How much do you want to invest per day?")}
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {PRESETS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => {
              setCustom(false);
              onChange(amount);
            }}
            className={`relative rounded-2xl border px-4 py-4 text-left ${
              !custom && dailyBudgetMxn === amount
                ? "border-wit-blue bg-wit-blue/[0.04]"
                : "border-wit-ink/8"
            }`}
          >
            {amount === RECOMMENDED ? (
              <span className="absolute -top-2.5 left-3 rounded-full bg-wit-blue px-2 py-0.5 text-[10px] font-bold text-white">
                {t("Recomendado", "Recommended")}
              </span>
            ) : null}
            <b className="text-lg text-wit-ink">${amount}</b>
            <span className="ml-1 text-xs font-bold text-wit-gray">MXN</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`rounded-2xl border px-4 py-4 text-left ${custom ? "border-wit-blue bg-wit-blue/[0.04]" : "border-wit-ink/8"}`}
        >
          <b className="text-lg text-wit-ink">{t("Otro", "Other")}</b>
        </button>
      </div>

      {custom ? (
        <label className="mt-4 block">
          <span className="text-xs font-bold text-wit-gray">
            {t("Presupuesto diario (MXN)", "Daily budget (MXN)")}
          </span>
          <div className="mt-1.5 flex h-13 items-center rounded-2xl border border-wit-ink/10 px-4">
            <span className="font-bold text-wit-gray">$</span>
            <input
              type="number"
              min={20}
              value={dailyBudgetMxn}
              onChange={(event) => onChange(Number(event.target.value))}
              className="min-w-0 flex-1 border-0 px-2 text-base font-bold text-wit-ink outline-none"
              autoFocus
            />
            <span className="text-xs font-bold text-wit-gray">MXN</span>
          </div>
        </label>
      ) : null}

      <div className="mt-5 rounded-2xl bg-wit-mist/35 p-4 text-sm leading-relaxed text-wit-gray">
        {t(
          `Con $${dailyBudgetMxn.toLocaleString()} MXN diarios podemos ayudarte a conseguir suficiente distribución para comenzar a medir resultados.`,
          `With $${dailyBudgetMxn.toLocaleString()} MXN per day we can help you get enough distribution to start measuring results.`,
        )}
      </div>
      <p className="mt-2 text-xs text-wit-gray">
        {t(
          "Puedes modificar tu presupuesto antes de activar la campaña.",
          "You can change your budget before activating the campaign.",
        )}
      </p>
    </div>
  );
}
