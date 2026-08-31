"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import PageHeader from "@/shared/ui/PageHeader";
import GenericEmptyState from "@/shared/ui/EmptyState";
import ExperimentComparison from "@/features/campaigns/ui/ExperimentComparison";

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

interface ExperimentVariant {
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
  variants: ExperimentVariant[];
}

interface AnalyticsData {
  totals: { impressions: number; clicks: number };
  series: { date: string; impressions: number; clicks: number }[];
  campaigns: CampaignRow[];
  experiments: Experiment[];
}

interface TemplateClickRow {
  templateId: string;
  templateName: string;
  clicks: number;
  lastClickedAt: string;
}

interface TemplateClickData {
  total: number;
  byTemplate: TemplateClickRow[];
  recent: { destination: string; label: string | null; clickedAt: string; templateName: string }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [linkData, setLinkData] = useState<TemplateClickData | null>(null);

  useEffect(() => {
    fetch("/api/campaigns/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("request failed"))))
      .then(setData)
      .catch(() => setData({ totals: { impressions: 0, clicks: 0 }, series: [], campaigns: [], experiments: [] }));

    fetch("/api/templates/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("request failed"))))
      .then(setLinkData)
      .catch(() => setLinkData({ total: 0, byTemplate: [], recent: [] }));
  }, []);

  const ctr = data && data.totals.impressions > 0 ? ((data.totals.clicks / data.totals.impressions) * 100).toFixed(1) : "0.0";

  return (
    <div>
      <PageHeader title="Analytics" description="Campaign banner and signature link performance." icon="solar:chart-broken" />

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

          {data && <ExperimentComparison experiments={data.experiments} />}

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

      <h2 className="mb-3 mt-8 font-display text-sm font-semibold text-text-hi">Signature link clicks</h2>
      <p className="mb-4 text-sm text-text-lo">
        Clicks on links inserted directly into a signature (the editor&apos;s &quot;Insert tracked link&quot; button) — separate from campaign banners above.
      </p>

      {linkData && linkData.byTemplate.length === 0 ? (
        <GenericEmptyState
          icon="solar:link-broken"
          title="No tracked link clicks yet"
          description="Insert a tracked link in a signature template to start seeing clicks here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-app-border bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-app-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-lo">
                <tr>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Clicks</th>
                  <th className="px-4 py-3">Last click</th>
                </tr>
              </thead>
              <tbody>
                {linkData?.byTemplate.map((row) => (
                  <tr key={row.templateId} className="border-b border-app-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text-hi">{row.templateName}</td>
                    <td className="px-4 py-3 text-text-lo">{row.clicks}</td>
                    <td className="px-4 py-3 text-text-lo">{new Date(row.lastClickedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-2xl border border-app-border bg-surface shadow-sm">
            <div className="border-b border-app-border bg-surface-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-lo">
              Recent clicks
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-app-border">
              {linkData?.recent.length === 0 && <p className="px-4 py-6 text-center text-sm text-text-lo">No clicks yet.</p>}
              {linkData?.recent.map((click, i) => (
                <div key={i} className="px-4 py-3 text-sm">
                  <p className="font-medium text-text-hi">{click.label || click.destination}</p>
                  <p className="truncate text-xs text-text-lo">
                    {click.templateName} · {new Date(click.clickedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
