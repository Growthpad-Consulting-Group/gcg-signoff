"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";

interface Analytics {
  totalClicks: number;
  thisMonthClicks: number;
  topLinks: { label: string; clicks: number }[];
}

export default function TemplateLinkAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates/analytics")
      .then((r) => r.json())
      .then(setAnalytics)
      .finally(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-app-border bg-surface p-4">
        <div className="h-24 bg-surface-2/50 rounded animate-pulse" />
      </div>
    );
  }

  if (!analytics || analytics.totalClicks === 0) {
    return (
      <div className="rounded-lg border border-app-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
            <Icon icon="solar:click-broken" className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-hi">Template link clicks</p>
            <p className="text-xs text-text-lo">No clicks yet — links in signatures appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href="/templates">
      <div className="rounded-lg border border-app-border bg-surface p-4 hover:bg-surface-2 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Icon icon="solar:click-broken" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-hi">Template link clicks</p>
              <p className="text-2xl font-bold text-text-hi">{analytics.totalClicks}</p>
            </div>
          </div>
          <p className="text-xs text-text-lo">{analytics.thisMonthClicks} this month</p>
        </div>

        {analytics.topLinks.length > 0 && (
          <div className="space-y-1.5 border-t border-app-border pt-3">
            <p className="text-xs font-medium text-text-lo uppercase tracking-wide">Top links</p>
            {analytics.topLinks.map((link, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-text-hi truncate">{link.label || "Unlabeled"}</span>
                <span className="text-text-lo font-medium">{link.clicks}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
