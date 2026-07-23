// Detailed feature-by-feature comparison, below the 3 fichas — for
// visitors who've already scanned the cards and want the full breakdown
// before deciding. Below lg (the same breakpoint the fichas stack at),
// 3 columns side by side don't fit a phone screen without horizontal
// scrolling, which felt clunky — so mobile gets a plan-switcher instead:
// tap a tab, see that plan's full feature list in one column, no
// sideways movement at all. Desktop keeps the full side-by-side table.
import { useState } from "react";
import { Check, Minus } from "lucide-react";

import { COMPARISON_ROWS, type ComparisonValue } from "../../lib/membership-comparison";
import { MEMBERSHIP_PLANS, type PlanId } from "../../lib/membership-plans";
import { useLanguage } from "../../lib/i18n";

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return (
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-wit-blue/15 text-wit-blue">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (value === null) {
    return <Minus className="mx-auto h-4 w-4 text-white/20" strokeWidth={2.5} />;
  }
  return <span className="font-wit-mono text-sm font-semibold text-white">{value}</span>;
}

export function MembershipComparisonTable() {
  const { t } = useLanguage();
  const [activePlan, setActivePlan] = useState<PlanId>("grow");

  return (
    <div className="mx-auto mt-16 max-w-5xl">
      <p className="text-center text-sm font-bold uppercase tracking-[0.22em] text-white/50">
        {t("Compara a detalle", "Compare in detail")}
      </p>

      {/* Desktop / tablet: full side-by-side table, 3 columns fit fine. */}
      <div className="mt-6 hidden overflow-hidden rounded-[28px] border border-white/10 lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="w-[38%] bg-wit-navy px-5 py-5 align-bottom" />
              {MEMBERSHIP_PLANS.map((m) => (
                <th
                  key={m.id}
                  className={`px-4 py-5 text-center align-bottom ${
                    m.destacada ? "bg-wit-blue/10" : "bg-wit-navy"
                  }`}
                >
                  {m.destacada ? (
                    <span className="mb-1.5 inline-block rounded-full bg-wit-blue px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      {t("Más popular", "Most popular")}
                    </span>
                  ) : null}
                  <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-white">
                    {m.nombre}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, i) => {
              const striped = i % 2 === 1;
              return (
                <tr key={row.label}>
                  <td
                    className={`px-5 py-4 text-sm text-white/80 ${
                      striped ? "bg-wit-navy-soft" : "bg-wit-navy"
                    }`}
                  >
                    {row.label}
                  </td>
                  {MEMBERSHIP_PLANS.map((m) => (
                    <td
                      key={m.id}
                      className={`px-4 py-4 text-center ${
                        m.destacada ? "bg-wit-blue/5" : striped ? "bg-wit-navy-soft" : ""
                      }`}
                    >
                      <Cell value={row.values[m.id]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one plan at a time, switched with tabs — nothing scrolls sideways. */}
      <div className="mt-6 lg:hidden">
        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          {MEMBERSHIP_PLANS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActivePlan(m.id)}
              className={`flex-1 rounded-full px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                activePlan === m.id ? "bg-wit-blue text-white" : "text-white/60"
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
          {COMPARISON_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${
                i % 2 === 1 ? "bg-wit-navy-soft" : "bg-wit-navy"
              }`}
            >
              <span className="text-sm text-white/80">{row.label}</span>
              <div className="shrink-0">
                <Cell value={row.values[activePlan]} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
