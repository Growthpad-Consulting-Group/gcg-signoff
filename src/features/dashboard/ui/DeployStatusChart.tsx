"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";

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

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, fill } = payload[0].payload;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-1.5 text-xs shadow-lg">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fill }} />
      <span className="text-text-lo">{name}</span>
      <span className="font-medium text-text-hi">{value}</span>
    </div>
  );
}

export default function DeployStatusChart({ deployed, pending, error }: DeployStatusChartProps) {
  const counts = { deployed, pending, error };
  const total = deployed + pending + error;
  const data = SEGMENTS.map((s) => ({ name: s.label, value: counts[s.key], fill: s.color }));

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        {total > 0 ? (
          <PieChart width={144} height={144}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={64}
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
              isAnimationActive
              animationDuration={600}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.value > 0 ? d.fill : "transparent"} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        ) : (
          <svg viewBox="0 0 144 144" className="h-full w-full">
            <circle cx="72" cy="72" r="56" fill="none" stroke="var(--border)" strokeWidth="16" />
          </svg>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
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
