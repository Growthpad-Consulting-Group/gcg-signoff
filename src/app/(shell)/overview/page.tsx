"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PageHeader from "@/shared/ui/PageHeader";
import DomainHealthStrip from "@/features/dashboard/ui/DomainHealthStrip";
import RecentActivity from "@/features/dashboard/ui/RecentActivity";
import CampaignSummary from "@/features/campaigns/ui/CampaignSummary";

import TemplateLinkAnalytics from "@/features/dashboard/ui/TemplateLinkAnalytics";

// Recharts is ~1MB — defer it out of the initial dashboard bundle so stat cards paint first.
const DeployStatusChart = dynamic(() => import("@/features/dashboard/ui/DeployStatusChart"), {
  ssr: false,
  loading: () => <div className="h-36" />,
});

interface Domain {
  id: string;
  name: string;
  gateway_status: "not_configured" | "pending_dns" | "active" | "error";
}

interface Stats {
  staffCount: number;
  templateCount: number;
  domainCount: number;
  deployedCount: number;
  pendingCount: number;
  errorCount: number;
  gmailSyncedCount: number;
  gmailPendingCount: number;
  gmailErrorCount: number;
  domains: Domain[];
}

// signature_assignments comes back as a single object (one-to-one via staff_id's unique
// constraint), not an array — despite embedded-resource syntax that looks list-like elsewhere.
function assignmentOf(staff: any): { deploy_status?: string; gmail_sync_status?: string } | null {
  const a = staff.signature_assignments;
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [staffRes, templatesRes, domainsRes] = await Promise.all([
        fetch("/api/staff").then((r) => r.json()),
        fetch("/api/templates").then((r) => r.json()),
        fetch("/api/domains").then((r) => r.json()),
      ]);
      const staff = staffRes.staff || [];
      const domains: Domain[] = domainsRes.domains || [];
      const assignments = staff.map(assignmentOf).filter(Boolean) as { deploy_status?: string; gmail_sync_status?: string }[];
      setStats({
        staffCount: staff.length,
        templateCount: (templatesRes.templates || []).length,
        domainCount: domains.length,
        deployedCount: assignments.filter((a) => a.deploy_status === "deployed").length,
        pendingCount: assignments.filter((a) => a.deploy_status === "pending").length,
        errorCount: assignments.filter((a) => a.deploy_status === "error").length,
        gmailSyncedCount: assignments.filter((a) => a.gmail_sync_status === "synced").length,
        gmailPendingCount: assignments.filter((a) => a.gmail_sync_status === "pending").length,
        gmailErrorCount: assignments.filter((a) => a.gmail_sync_status === "error").length,
        domains,
      });
    })();
  }, []);

  const cards = [
    { label: "Staff", value: stats?.staffCount, icon: "solar:users-group-rounded-broken", href: "/staff", accent: "bg-indigo-500/10 text-indigo-500" },
    { label: "Templates", value: stats?.templateCount, icon: "solar:pen-new-square-broken", href: "/templates", accent: "bg-violet-500/10 text-violet-500" },
    { label: "Domains", value: stats?.domainCount, icon: "solar:global-broken", href: "/domains", accent: "bg-teal-500/10 text-teal-500" },
    { label: "Gmail signatures synced", value: stats?.gmailSyncedCount, icon: "logos:google-gmail", href: "/staff", accent: "bg-emerald-500/10 text-emerald-500" },
    { label: "Gateway deployed", value: stats?.deployedCount, icon: "solar:check-circle-broken", href: "/staff", accent: "bg-sky-500/10 text-sky-500" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Signature coverage across your team." icon="solar:widget-2-broken" />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/templates?new=1"
          className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm font-medium text-text-hi transition-colors hover:bg-surface-2"
        >
          <Icon icon="solar:add-circle-broken" className="h-4 w-4 text-brand-500" />
          New template
        </Link>
        <Link
          href="/staff?new=1"
          className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm font-medium text-text-hi transition-colors hover:bg-surface-2"
        >
          <Icon icon="solar:user-plus-broken" className="h-4 w-4 text-brand-500" />
          Add staff
        </Link>
        <Link
          href="/domains?new=1"
          className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm font-medium text-text-hi transition-colors hover:bg-surface-2"
        >
          <Icon icon="solar:global-broken" className="h-4 w-4 text-brand-500" />
          Add domain
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm transition-colors hover:bg-surface-2"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.accent}`}>
              <Icon icon={card.icon} className="h-5 w-5" />
            </div>
            <p className="font-display text-2xl font-semibold text-text-hi">{card.value ?? "—"}</p>
            <p className="text-sm text-text-lo">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 font-display text-sm font-semibold text-text-hi">Gmail sync status</h2>
            {stats ? (
              <DeployStatusChart
                deployed={stats.gmailSyncedCount}
                pending={stats.gmailPendingCount}
                error={stats.gmailErrorCount}
                deployedLabel="Synced"
                centerLabel="opted in"
              />
            ) : (
              <div className="h-36" />
            )}
          </div>

          <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 font-display text-sm font-semibold text-text-hi">Gateway deploy status</h2>
            {stats ? (
              <DeployStatusChart deployed={stats.deployedCount} pending={stats.pendingCount} error={stats.errorCount} />
            ) : (
              <div className="h-36" />
            )}
          </div>

          <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 font-display text-sm font-semibold text-text-hi">Domain health</h2>
            {stats && <DomainHealthStrip domains={stats.domains} />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 font-display text-sm font-semibold text-text-hi">Recent activity</h2>
            <RecentActivity />
          </div>

          <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 font-display text-sm font-semibold text-text-hi">Campaign performance</h2>
            <CampaignSummary />
          </div>

          <div className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <TemplateLinkAnalytics />
          </div>

        </div>
      </div>
    </div>
  );
}
