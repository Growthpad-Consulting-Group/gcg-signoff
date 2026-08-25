"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import SimpleModal from "@/shared/ui/SimpleModal";
import Button from "@/shared/ui/Button";
import GenericEmptyState from "@/shared/ui/EmptyState";

interface Domain {
  id: string;
  name: string;
  platform: "google_workspace" | "microsoft_365" | "other";
  gateway_status: "not_configured" | "pending_dns" | "active" | "error";
  spf_verified: boolean;
  dkim_verified: boolean;
}

const PLATFORM_LABEL: Record<Domain["platform"], string> = {
  google_workspace: "Google Workspace",
  microsoft_365: "Microsoft 365",
  other: "Other / generic SMTP",
};

const STATUS_STYLE: Record<Domain["gateway_status"], string> = {
  not_configured: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  pending_dns: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Domain["platform"]>("google_workspace");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/domains").then((r) => r.json());
    setDomains(res.domains || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addDomain = async () => {
    if (!name.trim()) return;
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), platform }),
    });
    if (!res.ok) {
      toast.error("Failed to add domain");
      return;
    }
    toast.success("Domain added");
    setShowAdd(false);
    setName("");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Mail domains this workspace deploys signatures to."
        icon="solar:global-broken"
        actions={[{ label: "Add domain", icon: "solar:add-circle-broken", variant: "primary", onClick: () => setShowAdd(true) }]}
      />

      {!loading && domains.length === 0 && (
        <GenericEmptyState
          icon="solar:global-broken"
          title="No domains yet"
          description="Add a domain to start assigning staff and deploying signatures to it."
          action={{ label: "Add domain", onClick: () => setShowAdd(true) }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {domains.map((domain) => (
          <div key={domain.id} className="rounded-2xl border border-app-border bg-surface p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-text-hi">{domain.name}</p>
                <p className="text-sm text-text-lo">{PLATFORM_LABEL[domain.platform]}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[domain.gateway_status]}`}>
                {domain.gateway_status.replace("_", " ")}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-text-lo">
              <span className="flex items-center gap-1">
                <Icon icon={domain.spf_verified ? "solar:check-circle-bold" : "solar:close-circle-broken"} className={domain.spf_verified ? "text-emerald-500" : "text-text-lo"} />
                SPF
              </span>
              <span className="flex items-center gap-1">
                <Icon icon={domain.dkim_verified ? "solar:check-circle-bold" : "solar:close-circle-broken"} className={domain.dkim_verified ? "text-emerald-500" : "text-text-lo"} />
                DKIM
              </span>
            </div>
          </div>
        ))}
      </div>

      <SimpleModal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add domain" width="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-hi">Domain</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="growthpad.co.ke"
              className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-hi">Mail platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Domain["platform"])}
              className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="google_workspace">Google Workspace</option>
              <option value="microsoft_365">Microsoft 365</option>
              <option value="other">Other / generic SMTP</option>
            </select>
            <p className="mt-1 text-xs text-text-lo">
              Determines how signatures get deployed: Workspace uses an Outbound Gateway, M365 uses a transport rule, others need a relay.
            </p>
          </div>
          <Button className="w-full" onClick={addDomain}>
            Add domain
          </Button>
        </div>
      </SimpleModal>
    </div>
  );
}
