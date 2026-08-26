"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface AnalyticsTotals {
  totals: { impressions: number; clicks: number };
  campaigns: { active: boolean }[];
}

export default function CampaignSummary() {
  const [data, setData] = useState<AnalyticsTotals | null>(null);

  useEffect(() => {
    fetch("/api/campaigns/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ totals: { impressions: 0, clicks: 0 }, campaigns: [] }));
  }, []);

  const activeCount = data?.campaigns.filter((c) => c.active).length ?? 0;
  const ctr = data && data.totals.impressions > 0 ? ((data.totals.clicks / data.totals.impressions) * 100).toFixed(1) : "0.0";

  if (data && data.campaigns.length === 0) {
    return (
      <Link href="/campaigns" className="flex flex-col items-center gap-2 rounded-lg py-4 text-center transition-colors hover:bg-surface-2">
        <Icon icon="solar:megaphone-broken" className="h-6 w-6 text-text-lo" />
        <p className="text-sm text-text-lo">No campaigns yet — add a banner to your signatures.</p>
      </Link>
    );
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-display text-lg font-semibold text-text-hi">{data?.totals.impressions ?? "—"}</p>
          <p className="text-xs text-text-lo">Impressions</p>
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-text-hi">{data?.totals.clicks ?? "—"}</p>
          <p className="text-xs text-text-lo">Clicks</p>
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-text-hi">{data ? `${ctr}%` : "—"}</p>
          <p className="text-xs text-text-lo">CTR</p>
        </div>
      </div>
      <p className="mb-3 text-xs text-text-lo">{activeCount} active campaign{activeCount === 1 ? "" : "s"}</p>
      <Link href="/analytics" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
        View full analytics
        <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
