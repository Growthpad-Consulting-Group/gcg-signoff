"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import PageHeader from "@/shared/ui/PageHeader";
import GenericEmptyState from "@/shared/ui/EmptyState";

const CampaignTrendChart = dynamic(() => import("@/features/campaigns/ui/CampaignTrendChart"), {
  ssr: false,
  loading: () => <div className="h-64" />,
});

interface CampaignRow {
  id: string;
  name: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
}

interface AnalyticsData {
  totals: { impressions: number; clicks: number };
  series: { date: string; impressions: number; clicks: number }[];
  campaigns: CampaignRow[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch("/api/campaigns/analytics")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const ctr = data && data.totals.impressions > 0 ? ((data.totals.clicks / data.totals.impressions) * 100).toFixed(1) : "0.0";

  return (
    <div>
      <PageHeader title="Analytics" description="Campaign banner performance across all signatures." icon="solar:chart-broken" />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            <Icon icon="solar:eye-broken" className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="font-display text-2xl font-semibold text-text-hi">{data?.totals.impressions ?? "—"}</p>
          <p className="text-sm text-text-lo">Impressions</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Icon icon="solar:cursor-broken" className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="font-display text-2xl font-semibold text-text-hi">{data?.totals.clicks ?? "—"}</p>
          <p className="text-sm text-text-lo">Clicks</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Icon icon="solar:graph-up-broken" className="h-5 w-5 text-amber-500" />
          </div>
          <p className="font-display text-2xl font-semibold text-text-hi">{data ? `${ctr}%` : "—"}</p>
          <p className="text-sm text-text-lo">Click-through rate</p>
        </div>
      </div>

      {data && data.campaigns.length === 0 ? (
        <GenericEmptyState
          icon="solar:chart-broken"
          title="No campaigns yet"
          description="Create a campaign to start tracking impressions and clicks."
          action={{ label: "Go to campaigns", onClick: () => (window.location.href = "/campaigns") }}
        />
      ) : (
        <>
          <div className="mb-4 rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 font-display text-sm font-semibold text-text-hi">Last 30 days</h2>
            {data ? <CampaignTrendChart series={data.series} /> : <div className="h-64" />}
          </div>

          <div className="overflow-hidden rounded-2xl border border-app-border bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-app-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-lo">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Impressions</th>
                  <th className="px-4 py-3">Clicks</th>
                  <th className="px-4 py-3">CTR</th>
                </tr>
              </thead>
              <tbody>
                {data?.campaigns
                  .slice()
                  .sort((a, b) => b.clicks - a.clicks)
                  .map((c) => {
                    const rowCtr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={c.id} className="border-b border-app-border last:border-0">
                        <td className="px-4 py-3 font-medium text-text-hi">{c.name}</td>
                        <td className="px-4 py-3 text-text-lo">{c.active ? "Active" : "Paused"}</td>
                        <td className="px-4 py-3 text-text-lo">{c.impressions}</td>
                        <td className="px-4 py-3 text-text-lo">{c.clicks}</td>
                        <td className="px-4 py-3 text-text-lo">{rowCtr}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
