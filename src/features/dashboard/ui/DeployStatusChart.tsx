"use client";

interface DeployStatusChartProps {
  deployed: number;
  pending: number;
  error: number;
}

// Status colors are fixed/reserved (good/warning/critical), matching the same
// emerald/amber/rose used for deploy_status pills across Staff/Domains pages.
// Values come from --status-* in globals.css, validated per-surface (light/dark)
// via the dataviz skill's validate_palette.js.
const SEGMENTS = [
  { key: "deployed", label: "Deployed", color: "var(--status-deployed)" },
  { key: "pending", label: "Pending", color: "var(--status-pending)" },
  { key: "error", label: "Error", color: "var(--status-error)" },
] as const;

const GAP = 1.5; // percentage-points of gap between segments, in pathLength units (0-100)

export default function DeployStatusChart({ deployed, pending, error }: DeployStatusChartProps) {
  const counts = { deployed, pending, error };
  const total = deployed + pending + error;

  const nonZeroCount = SEGMENTS.filter((s) => counts[s.key] > 0).length;
  let cursor = 0;
  const arcs = SEGMENTS.map((s) => {
    const value = counts[s.key];
    const share = total > 0 ? (value / total) * 100 : 0;
    const gap = nonZeroCount > 1 && value > 0 ? GAP : 0;
    const dash = Math.max(share - gap, 0);
    const arc = { ...s, value, share, dashArray: `${dash} ${100 - dash}`, dashOffset: -cursor };
    cursor += share;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
          {total > 0 &&
            arcs.map(
              (a) =>
                a.value > 0 && (
                  <circle
                    key={a.key}
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke={a.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={a.dashArray}
                    strokeDashoffset={a.dashOffset}
                  />
                )
            )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold text-text-hi">{total}</span>
          <span className="text-[11px] text-text-lo">assigned</span>
        </div>
      </div>

      <div className="space-y-2">
        {SEGMENTS.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-text-lo">{s.label}</span>
            <span className="font-medium text-text-hi">{counts[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
