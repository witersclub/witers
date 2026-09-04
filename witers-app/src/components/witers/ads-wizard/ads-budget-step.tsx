import { useState } from "react";

import { useLanguage } from "../../../lib/i18n";

const PRESETS = [100, 200, 300];
const RECOMMENDED = 200;

// CAMBIO 02 — strips to digits only, then drops leading zeros UNLESS that
// would eat the only digit typed so far (so "00020" -> "20", but a lone
// "0" stays "0" while the client is still typing, rather than vanishing
// out from under their cursor).
function normalizeDigits(input: string): string {
  const digitsOnly = input.replace(/\D/g, "");
  return digitsOnly.replace(/^0+(?=\d)/, "");
}

export function AdsBudgetStep({
  dailyBudgetMxn,
  onChange,
}: {
  dailyBudgetMxn: number;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  const [custom, setCustom] = useState(!PRESETS.includes(dailyBudgetMxn));
  // CAMBIO 02 — the real bug: this component used to have no buffer of its
  // own and bound the input's `value` straight to the numeric
  // dailyBudgetMxn prop. A cleared field has no valid number, so that
  // forced `value={0}` back into the DOM on every keystroke — "borrar
  // todo" always snapped back to a literal "0" on screen, and typing "2"
  // then "0" landed the new digit next to that stuck zero instead of
  // replacing it, producing "020". A local string buffer is what makes an
  // actually-empty state representable; dailyBudgetMxn (owned by
  // campaign-creation-sheet.tsx) stays the one real source of truth for
  // the committed value — this never introduces a second one.
  const [rawInput, setRawInput] = useState(() =>
    PRESETS.includes(dailyBudgetMxn) ? "" : String(dailyBudgetMxn),
  );

  function selectPreset(amount: number) {
    setCustom(false);
    setRawInput("");
    onChange(amount);
  }

  function selectCustom() {
    setCustom(true);
    // Otro never inherits whatever preset was active — an empty field
    // that silently kept the old preset's number would let a client
    // continue with a budget they never actually chose.
    setRawInput("");
    onChange(0);
  }

  function handleCustomChange(value: string) {
    const normalized = normalizeDigits(value);
    setRawInput(normalized);
    onChange(normalized === "" ? 0 : Number(normalized));
  }

  const hasValidCustomAmount = custom && dailyBudgetMxn > 0;

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
            onClick={() => selectPreset(amount)}
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
          onClick={selectCustom}
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
          <div className="mt-1.5 flex h-13 items-center rounded-2xl border border-wit-ink/10 px-4 focus-within:border-wit-blue">
            <span className="font-bold text-wit-gray">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={rawInput}
              placeholder="0"
              onChange={(event) => handleCustomChange(event.target.value)}
              className="min-w-0 flex-1 border-0 px-2 text-base font-bold text-wit-ink outline-none placeholder:text-wit-ink/25"
              autoFocus
            />
            <span className="text-xs font-bold text-wit-gray">MXN</span>
          </div>
        </label>
      ) : null}

      <div className="mt-5 rounded-2xl bg-wit-mist/35 p-4 text-sm leading-relaxed text-wit-gray">
        {custom && !hasValidCustomAmount
          ? t(
              "Ingresa el presupuesto diario que quieres invertir.",
              "Enter the daily budget you want to invest.",
            )
          : t(
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
