"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import SimpleModal from "@/shared/ui/SimpleModal";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import Button from "@/shared/ui/Button";
import GenericEmptyState from "@/shared/ui/EmptyState";
import SetupGuideModal from "@/features/domains/ui/SetupGuideModal";
import CloudflareSection from "@/features/domains/ui/CloudflareSection";

interface Domain {
  id: string;
  name: string;
  platform: "google_workspace" | "microsoft_365" | "other";
  gateway_status: "not_configured" | "pending_dns" | "active" | "error";
  spf_verified: boolean;
  dkim_verified: boolean;
  notes: string | null;
  cloudflare_zone_id: string | null;
}

const PLATFORM_LABEL: Record<Domain["platform"], string> = {
  google_workspace: "Google Workspace",
  microsoft_365: "Microsoft 365",
  other: "Other / generic SMTP",
};

const PLATFORM_SETUP_STEP: Record<Domain["platform"], string> = {
  google_workspace: "Configure the Outbound Gateway in Google Workspace Admin Console.",
  microsoft_365: "Configure a transport rule in the Microsoft 365 admin center.",
  other: "Point this domain's outbound mail through your relay.",
};

interface VerifyResult {
  provider: string | null;
  spfRecord: string | null;
  spfExpected: string;
  dkimSelectors: string[];
}

const GATEWAY_STATUS_LABEL: Record<Domain["gateway_status"], string> = {
  not_configured: "Not configured",
  pending_dns: "Pending DNS",
  active: "Active",
  error: "Error",
};

const STATUS_STYLE: Record<Domain["gateway_status"], string> = {
  not_configured: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  pending_dns: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function DomainsPage() {
  return (
    <Suspense fallback={null}>
      <DomainsPageInner />
    </Suspense>
  );
}

function DomainsPageInner() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Domain["platform"]>("google_workspace");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [guideTarget, setGuideTarget] = useState<Domain | null>(null);
  const router = useRouter();
  const handledNewParam = useRef(false);
  const searchParams = useSearchParams();

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/domains").then((r) => r.json());
    setDomains(res.domains || []);
    setStaffCounts(res.staffCounts || {});
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1" && !handledNewParam.current) {
      handledNewParam.current = true;
      router.replace("/domains");
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const addDomain = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), platform }),
    });
    setAdding(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to add domain");
      return;
    }
    toast.success("Domain added");
    setShowAdd(false);
    setName("");
    load();
  };

  const patchDomain = async (domain: Domain, patch: Partial<Pick<Domain, "platform" | "gateway_status" | "notes">>) => {
    setPatchingId(domain.id);
    // Optimistic update so the inline control feels immediate.
    setDomains((prev) => prev.map((d) => (d.id === domain.id ? { ...d, ...patch } : d)));
    const res = await fetch(`/api/domains/${domain.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPatchingId(null);
    if (!res.ok) {
      toast.error("Failed to update domain");
      load(); // revert the optimistic update to whatever's actually saved
      return;
    }
    const { domain: updated } = await res.json();
    setDomains((prev) => prev.map((d) => (d.id === domain.id ? updated : d)));
  };

  const deleteDomain = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/domains/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete domain");
      return;
    }
    toast.success("Domain deleted");
    setDeleteTarget(null);
    load();
  };

  const verifyDns = async (domain: Domain) => {
    setVerifying((prev) => new Set(prev).add(domain.id));
    const res = await fetch(`/api/domains/${domain.id}/verify`, { method: "POST" });
    setVerifying((prev) => {
      const next = new Set(prev);
      next.delete(domain.id);
      return next;
    });
    if (!res.ok) {
      toast.error("Failed to verify DNS");
      return;
    }
    const result = await res.json();
    setDomains((prev) => prev.map((d) => (d.id === domain.id ? result.domain : d)));
    setVerifyResults((prev) => ({
      ...prev,
      [domain.id]: {
        provider: result.provider,
        spfRecord: result.spfRecord,
        spfExpected: result.spfExpected,
        dkimSelectors: result.dkimSelectors,
      },
    }));
    toast.success("DNS checked");
  };

  const deleteStaffCount = deleteTarget ? staffCounts[deleteTarget.id] || 0 : 0;

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
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-text-hi">{domain.name}</p>
                <div className="flex items-center gap-1.5">
                  <select
                    value={domain.platform}
                    onChange={(e) => patchDomain(domain, { platform: e.target.value as Domain["platform"] })}
                    disabled={patchingId === domain.id}
                    className="-ml-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-text-lo outline-none transition-colors hover:border-app-border focus:border-app-border focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                  >
                    <option value="google_workspace">{PLATFORM_LABEL.google_workspace}</option>
                    <option value="microsoft_365">{PLATFORM_LABEL.microsoft_365}</option>
                    <option value="other">{PLATFORM_LABEL.other}</option>
                  </select>
                  {verifyResults[domain.id]?.provider && (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-lo">
                      DNS: {verifyResults[domain.id].provider}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  value={domain.gateway_status}
                  onChange={(e) => patchDomain(domain, { gateway_status: e.target.value as Domain["gateway_status"] })}
                  disabled={patchingId === domain.id}
                  className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none disabled:opacity-50 ${STATUS_STYLE[domain.gateway_status]}`}
                  title={domain.gateway_status === "active" ? "Set automatically — can be reverted, not set manually" : "Gateway status"}
                >
                  {(Object.keys(GATEWAY_STATUS_LABEL) as Domain["gateway_status"][])
                    .filter((s) => s !== "active" || domain.gateway_status === "active")
                    .map((s) => (
                      <option key={s} value={s}>
                        {GATEWAY_STATUS_LABEL[s]}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setDeleteTarget(domain)}
                  className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-status-danger/10 hover:text-status-danger"
                  title="Delete domain"
                >
                  <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <textarea
              defaultValue={domain.notes || ""}
              placeholder="+ Add a note (e.g. DNS propagating, ETA Friday)"
              rows={1}
              onBlur={(e) => {
                const value = e.target.value.trim() || null;
                if (value !== domain.notes) patchDomain(domain, { notes: value });
              }}
              className="mb-3 w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs text-text-lo outline-none transition-colors hover:border-app-border focus:border-app-border focus:ring-1 focus:ring-brand-500"
            />

            <div className="mb-3 flex items-center gap-4 text-xs text-text-lo">
              <span className="flex items-center gap-1">
                <Icon icon={domain.spf_verified ? "solar:check-circle-bold" : "solar:close-circle-broken"} className={domain.spf_verified ? "text-emerald-500" : "text-text-lo"} />
                SPF
              </span>
              <span className="flex items-center gap-1">
                <Icon icon={domain.dkim_verified ? "solar:check-circle-bold" : "solar:close-circle-broken"} className={domain.dkim_verified ? "text-emerald-500" : "text-text-lo"} />
                DKIM
              </span>
              <span className="flex items-center gap-1">
                <Icon icon="solar:users-group-rounded-broken" className="h-3.5 w-3.5" />
                {staffCounts[domain.id] || 0} staff
              </span>
              <button
                onClick={() => verifyDns(domain)}
                disabled={verifying.has(domain.id)}
                className="ml-auto inline-flex items-center gap-1 font-medium text-brand-600 hover:underline disabled:opacity-50"
              >
                {verifying.has(domain.id) ? (
                  <Icon icon="solar:loading-bold" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon icon="solar:refresh-broken" className="h-3.5 w-3.5" />
                )}
                Verify DNS
              </button>
            </div>

            {verifyResults[domain.id] && (
              <div className="mb-3 space-y-1 rounded-lg bg-surface-2 p-2.5 font-mono text-[11px] text-text-lo">
                <p className="truncate">
                  SPF found: {verifyResults[domain.id].spfRecord || "none"}
                </p>
                <p className="truncate">SPF expected: {verifyResults[domain.id].spfExpected}</p>
                <p className="truncate">
                  DKIM selectors found: {verifyResults[domain.id].dkimSelectors.length > 0 ? verifyResults[domain.id].dkimSelectors.join(", ") : "none"}
                </p>
              </div>
            )}

            <div className="mb-3">
              <CloudflareSection
                domainId={domain.id}
                connected={!!domain.cloudflare_zone_id}
                detectedProvider={verifyResults[domain.id]?.provider ?? null}
                onChanged={load}
              />
            </div>

            {domain.gateway_status !== "active" && (
              <div className="rounded-lg border border-dashed border-app-border p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-lo">Next steps</p>
                  <button
                    onClick={() => setGuideTarget(domain)}
                    className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    <Icon icon="solar:book-broken" className="h-3 w-3" />
                    Setup guide
                  </button>
                </div>
                <ul className="space-y-1 text-xs text-text-lo">
                  <li className="flex items-start gap-1.5">
                    <Icon
                      icon={domain.spf_verified && domain.dkim_verified ? "solar:check-circle-bold" : "solar:circle-broken"}
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${domain.spf_verified && domain.dkim_verified ? "text-emerald-500" : "text-text-lo"}`}
                    />
                    Add the SPF/DKIM records above at your DNS provider.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Icon icon="solar:circle-broken" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-lo" />
                    {PLATFORM_SETUP_STEP[domain.platform]}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Icon icon="solar:circle-broken" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-lo" />
                    Add staff — this domain activates automatically once their first signature deploys.
                  </li>
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <SimpleModal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add domain" width="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            addDomain();
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-text-hi">Domain</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="growthpad.co.ke"
              autoFocus
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
          <Button type="submit" className="w-full" disabled={!name.trim() || adding}>
            {adding ? "Adding…" : "Add domain"}
          </Button>
        </form>
      </SimpleModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete domain?"
        message={
          deleteStaffCount > 0
            ? `Delete "${deleteTarget?.name}"? This domain has ${deleteStaffCount} staff member${deleteStaffCount === 1 ? "" : "s"} — they will be deleted too.`
            : `Delete "${deleteTarget?.name}"? This can't be undone.`
        }
        confirmLabel="Delete"
        onConfirm={deleteDomain}
        onClose={() => setDeleteTarget(null)}
      />

      {guideTarget && (
        <SetupGuideModal
          isOpen={!!guideTarget}
          onClose={() => setGuideTarget(null)}
          platform={guideTarget.platform}
          domainId={guideTarget.id}
          domainName={guideTarget.name}
        />
      )}
    </div>
  );
}
