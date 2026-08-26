"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import SimpleModal from "@/shared/ui/SimpleModal";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import Button from "@/shared/ui/Button";
import GenericEmptyState from "@/shared/ui/EmptyState";

interface Domain {
  id: string;
  name: string;
  platform: "google_workspace" | "microsoft_365" | "other";
  gateway_status: "not_configured" | "pending_dns" | "active" | "error";
  spf_verified: boolean;
  dkim_verified: boolean;
  notes: string | null;
}

const PLATFORM_LABEL: Record<Domain["platform"], string> = {
  google_workspace: "Google Workspace",
  microsoft_365: "Microsoft 365",
  other: "Other / generic SMTP",
};

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

interface EditForm {
  name: string;
  platform: Domain["platform"];
  gateway_status: Domain["gateway_status"];
  spf_verified: boolean;
  dkim_verified: boolean;
  notes: string;
}

function toEditForm(domain: Domain): EditForm {
  return {
    name: domain.name,
    platform: domain.platform,
    gateway_status: domain.gateway_status,
    spf_verified: domain.spf_verified,
    dkim_verified: domain.dkim_verified,
    notes: domain.notes || "",
  };
}

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
  const [editTarget, setEditTarget] = useState<Domain | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const router = useRouter();
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
    if (searchParams.get("new") === "1") {
      router.replace("/domains");
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const openEdit = (domain: Domain) => {
    setEditTarget(domain);
    setEditForm(toEditForm(domain));
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm) return;
    setSaving(true);
    const res = await fetch(`/api/domains/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        platform: editForm.platform,
        gateway_status: editForm.gateway_status,
        spf_verified: editForm.spf_verified,
        dkim_verified: editForm.dkim_verified,
        notes: editForm.notes.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save domain");
      return;
    }
    toast.success("Domain updated");
    setEditTarget(null);
    setEditForm(null);
    load();
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
                <p className="text-sm text-text-lo">{PLATFORM_LABEL[domain.platform]}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[domain.gateway_status]}`}>
                  {domain.gateway_status.replace("_", " ")}
                </span>
                <button
                  onClick={() => openEdit(domain)}
                  className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
                  title="Edit domain"
                >
                  <Icon icon="solar:pen-broken" className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(domain)}
                  className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-status-danger/10 hover:text-status-danger"
                  title="Delete domain"
                >
                  <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {domain.notes && <p className="mb-3 text-xs text-text-lo">{domain.notes}</p>}

            <div className="flex items-center gap-4 text-xs text-text-lo">
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

      <SimpleModal
        isOpen={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          setEditForm(null);
        }}
        title={`Edit ${editTarget?.name ?? "domain"}`}
        width="max-w-md"
      >
        {editForm && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-hi">Domain</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-hi">Mail platform</label>
              <select
                value={editForm.platform}
                onChange={(e) => setEditForm({ ...editForm, platform: e.target.value as Domain["platform"] })}
                className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="google_workspace">Google Workspace</option>
                <option value="microsoft_365">Microsoft 365</option>
                <option value="other">Other / generic SMTP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-hi">Gateway status</label>
              <select
                value={editForm.gateway_status}
                onChange={(e) => setEditForm({ ...editForm, gateway_status: e.target.value as Domain["gateway_status"] })}
                className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              >
                {(Object.keys(GATEWAY_STATUS_LABEL) as Domain["gateway_status"][]).map((s) => (
                  <option key={s} value={s}>
                    {GATEWAY_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-lo">Set to Active once the gateway is really deploying signatures for this domain.</p>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-text-hi">
                <input
                  type="checkbox"
                  checked={editForm.spf_verified}
                  onChange={(e) => setEditForm({ ...editForm, spf_verified: e.target.checked })}
                />
                SPF verified
              </label>
              <label className="flex items-center gap-2 text-sm text-text-hi">
                <input
                  type="checkbox"
                  checked={editForm.dkim_verified}
                  onChange={(e) => setEditForm({ ...editForm, dkim_verified: e.target.checked })}
                />
                DKIM verified
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-hi">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="e.g. DNS propagating, ETA Friday"
                rows={3}
                className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Button className="w-full" onClick={saveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
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
    </div>
  );
}
