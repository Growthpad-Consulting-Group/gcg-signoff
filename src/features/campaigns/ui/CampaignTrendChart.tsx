"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface SeriesPoint {
  date: string;
  impressions: number;
  clicks: number;
}

interface CampaignTrendChartProps {
  series: SeriesPoint[];
}

// Impressions and clicks are wildly different scales — a dual-axis chart would invent a false
// correlation (see dataviz skill anti-patterns), so these render as two small multiples instead,
// each on its own honestly-scaled axis. Indigo/emerald match the stat tiles above for identity.
const PANELS: { key: "impressions" | "clicks"; label: string; color: string }[] = [
  { key: "impressions", label: "Impressions", color: "#6366f1" },
  { key: "clicks", label: "Clicks", color: "#10b981" },
];

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-app-border bg-surface px-3 py-1.5 text-xs shadow-lg">
      <p className="mb-0.5 text-text-lo">{formatDate(label)}</p>
      <p className="font-medium text-text-hi">{payload[0].value}</p>
    </div>
  );
}

export default function CampaignTrendChart({ series }: CampaignTrendChartProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {PANELS.map((panel) => (
        <div key={panel.key}>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-lo">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: panel.color }} />
            {panel.label}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${panel.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={panel.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={panel.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: "var(--text-lo)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-lo)" }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey={panel.key} stroke={panel.color} strokeWidth={2} fill={`url(#fill-${panel.key})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
