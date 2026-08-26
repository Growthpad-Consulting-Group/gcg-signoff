import { Icon } from "@iconify/react";

interface Variant {
  id: string;
  name: string;
  variant_label: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface Experiment {
  id: string;
  name: string;
  variants: Variant[];
}

// Below this many impressions, a CTR difference is mostly noise — don't highlight a "winner" yet.
const MIN_IMPRESSIONS_FOR_WINNER = 20;

export default function ExperimentComparison({ experiments }: { experiments: Experiment[] }) {
  if (experiments.length === 0) return null;

  return (
    <div className="mb-4 space-y-4">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-text-hi">
        <Icon icon="solar:test-tube-broken" className="h-4 w-4" />
        Experiments
      </h2>
      {experiments.map((exp) => {
        const totalImpressions = exp.variants.reduce((sum, v) => sum + v.impressions, 0);
        const eligible = totalImpressions >= MIN_IMPRESSIONS_FOR_WINNER;
        const leaderId = eligible
          ? exp.variants.reduce((best, v) => (v.ctr > (best?.ctr ?? -1) ? v : best), exp.variants[0])?.id
          : null;

        return (
          <div key={exp.id} className="overflow-hidden rounded-2xl border border-app-border bg-surface shadow-sm">
            <div className="border-b border-app-border px-4 py-3">
              <p className="font-medium text-text-hi">{exp.name}</p>
              {!eligible && (
                <p className="text-xs text-text-lo">Waiting for more data ({totalImpressions}/{MIN_IMPRESSIONS_FOR_WINNER} impressions) before highlighting a leader.</p>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-app-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-lo">
                <tr>
                  <th className="px-4 py-2">Variant</th>
                  <th className="px-4 py-2">Impressions</th>
                  <th className="px-4 py-2">Clicks</th>
                  <th className="px-4 py-2">CTR</th>
                </tr>
              </thead>
              <tbody>
                {exp.variants.map((v) => (
                  <tr key={v.id} className="border-b border-app-border last:border-0">
                    <td className="px-4 py-2 font-medium text-text-hi">
                      <span className="flex items-center gap-1.5">
                        {v.variant_label ? `${v.variant_label} — ${v.name}` : v.name}
                        {v.id === leaderId && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Leading
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-lo">{v.impressions}</td>
                    <td className="px-4 py-2 text-text-lo">{v.clicks}</td>
                    <td className="px-4 py-2 text-text-lo">{(v.ctr * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
