"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

interface Domain {
  id: string;
  name: string;
  gateway_status: "not_configured" | "pending_dns" | "active" | "error";
}

// Same status → style mapping as src/app/(shell)/domains/page.tsx, kept in sync deliberately.
const STATUS_STYLE: Record<Domain["gateway_status"], string> = {
  not_configured: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  pending_dns: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function DomainHealthStrip({ domains }: { domains: Domain[] }) {
  if (domains.length === 0) {
    return <p className="text-sm text-text-lo">No domains yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {domains.map((d) => (
        <Link
          key={d.id}
          href="/domains"
          className="flex items-center gap-2 rounded-full border border-app-border bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-surface-2"
        >
          <Icon icon="solar:global-broken" className="h-3.5 w-3.5 text-text-lo" />
          <span className="font-medium text-text-hi">{d.name}</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[d.gateway_status]}`}>
            {d.gateway_status.replace("_", " ")}
          </span>
        </Link>
      ))}
    </div>
  );
}
