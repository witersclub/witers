// Detailed feature-by-feature comparison, below the 3 fichas — for
// visitors who've already scanned the cards and want the full breakdown
// before deciding. First column stays fixed while the 3 plan columns
// scroll horizontally on narrow screens (3 data columns + labels don't
// fit a phone width side by side).
import { Check, Minus } from "lucide-react";

import { COMPARISON_ROWS, type ComparisonValue } from "../../lib/membership-comparison";
import { MEMBERSHIP_PLANS } from "../../lib/membership-plans";

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
  return (
    <div className="mx-auto mt-16 max-w-5xl">
      <p className="text-center text-sm font-bold uppercase tracking-[0.22em] text-white/50">
        Compara a detalle
      </p>
      <div className="mt-6 overflow-x-auto rounded-[28px] border border-white/10">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[42%] bg-wit-navy px-5 py-5 align-bottom sm:w-[38%]" />
              {MEMBERSHIP_PLANS.map((m) => (
                <th
                  key={m.id}
                  className={`px-4 py-5 text-center align-bottom ${
                    m.destacada ? "bg-wit-blue/10" : "bg-wit-navy"
                  }`}
                >
                  {m.destacada ? (
                    <span className="mb-1.5 inline-block rounded-full bg-wit-blue px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      Más popular
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
                    className={`sticky left-0 z-10 px-5 py-4 text-sm text-white/80 ${
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
    </div>
  );
}
