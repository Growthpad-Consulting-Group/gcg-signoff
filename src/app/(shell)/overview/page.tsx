"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import PageHeader from "@/shared/ui/PageHeader";

interface Stats {
  staffCount: number;
  templateCount: number;
  domainCount: number;
  deployedCount: number;
  pendingCount: number;
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
      const deployed = staff.filter((s: any) => s.signature_assignments?.[0]?.deploy_status === "deployed").length;
      const pending = staff.filter((s: any) => (s.signature_assignments?.[0]?.deploy_status ?? "pending") === "pending").length;
      setStats({
        staffCount: staff.length,
        templateCount: (templatesRes.templates || []).length,
        domainCount: (domainsRes.domains || []).length,
        deployedCount: deployed,
        pendingCount: pending,
      });
    })();
  }, []);

  const cards = [
    { label: "Staff", value: stats?.staffCount, icon: "solar:users-group-rounded-broken", href: "/staff" },
    { label: "Templates", value: stats?.templateCount, icon: "solar:pen-new-square-broken", href: "/templates" },
    { label: "Domains", value: stats?.domainCount, icon: "solar:global-broken", href: "/domains" },
    { label: "Signatures deployed", value: stats?.deployedCount, icon: "solar:check-circle-broken", href: "/staff" },
    { label: "Pending deploy", value: stats?.pendingCount, icon: "solar:clock-circle-broken", href: "/staff" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Signature coverage across your team." icon="solar:widget-2-broken" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm transition-colors hover:bg-surface-2"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
              <Icon icon={card.icon} className="h-5 w-5 text-brand-500" />
            </div>
            <p className="font-display text-2xl font-semibold text-text-hi">{card.value ?? "—"}</p>
            <p className="text-sm text-text-lo">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
