"use client";

import { useEffect, useRef, useState } from "react";
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
}

interface Campaign {
  id: string;
  name: string;
  image_url: string;
  link_url: string;
  domain_id: string | null;
  weight: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface CampaignForm {
  name: string;
  image_url: string;
  link_url: string;
  domain_id: string;
  weight: number;
  starts_at: string;
  ends_at: string;
}

const EMPTY_FORM: CampaignForm = { name: "", image_url: "", link_url: "", domain_id: "", weight: 1, starts_at: "", ends_at: "" };

function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      toast.error("Failed to upload image");
      return;
    }
    const { data } = await res.json();
    if (data?.[0]) onChange(data[0]);
  };

  return (
    <div className="space-y-2">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded via our own storage bucket, but arbitrary path
        <img src={value} alt="Banner preview" className="h-16 w-full rounded-lg border border-app-border object-cover" />
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-surface px-3 py-1.5 text-xs font-medium text-text-hi transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {uploading ? <Icon icon="solar:loading-bold" className="h-3.5 w-3.5 animate-spin" /> : <Icon icon="solar:gallery-broken" className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : value ? "Change image" : "Upload image"}
        </button>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totals, setTotals] = useState<Record<string, { impressions: number; clicks: number }>>({});
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState<CampaignForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const domainById = new Map(domains.map((d) => [d.id, d]));

  const load = async () => {
    setLoading(true);
    const [campaignsRes, domainsRes] = await Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ]);
    setCampaigns(campaignsRes.campaigns || []);
    setTotals(campaignsRes.totals || {});
    setDomains(domainsRes.domains || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const canSubmit = (f: CampaignForm) => f.name.trim() && f.image_url.trim() && f.link_url.trim();

  const addCampaign = async () => {
    if (!canSubmit(form)) return;
    setSaving(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        domain_id: form.domain_id || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to create campaign");
      return;
    }
    toast.success("Campaign created");
    setShowAdd(false);
    setForm(EMPTY_FORM);
    load();
  };

  const openEdit = (campaign: Campaign) => {
    setEditTarget(campaign);
    setEditForm({
      name: campaign.name,
      image_url: campaign.image_url,
      link_url: campaign.link_url,
      domain_id: campaign.domain_id || "",
      weight: campaign.weight,
      starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 10) : "",
      ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 10) : "",
    });
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm || !canSubmit(editForm)) return;
    setSaving(true);
    const res = await fetch(`/api/campaigns/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        image_url: editForm.image_url,
        link_url: editForm.link_url,
        domain_id: editForm.domain_id || null,
        weight: editForm.weight,
        starts_at: editForm.starts_at || null,
        ends_at: editForm.ends_at || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save campaign");
      return;
    }
    toast.success("Campaign updated");
    setEditTarget(null);
    setEditForm(null);
    load();
  };

  const toggleActive = async (campaign: Campaign) => {
    setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, active: !c.active } : c)));
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !campaign.active }),
    });
    if (!res.ok) {
      toast.error("Failed to update campaign");
      load();
    }
  };

  const deleteCampaign = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/campaigns/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete campaign");
      return;
    }
    toast.success("Campaign deleted");
    setDeleteTarget(null);
    setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
  };

  const FormFields = ({ f, setF }: { f: CampaignForm; setF: (updater: (prev: CampaignForm) => CampaignForm) => void }) => (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-text-hi">Name</label>
        <input
          value={f.name}
          onChange={(e) => setF((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. Q3 webinar"
          className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text-hi">Banner image</label>
        <ImageField value={f.image_url} onChange={(url) => setF((prev) => ({ ...prev, image_url: url }))} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text-hi">Link URL</label>
        <input
          value={f.link_url}
          onChange={(e) => setF((prev) => ({ ...prev, link_url: e.target.value }))}
          placeholder="https://..."
          className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Domain</label>
          <select
            value={f.domain_id}
            onChange={(e) => setF((prev) => ({ ...prev, domain_id: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Weight</label>
          <input
            type="number"
            min={1}
            value={f.weight}
            onChange={(e) => setF((prev) => ({ ...prev, weight: Number(e.target.value) || 1 }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-text-lo">Relative odds when multiple campaigns overlap.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Starts</label>
          <input
            type="date"
            value={f.starts_at}
            onChange={(e) => setF((prev) => ({ ...prev, starts_at: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Ends</label>
          <input
            type="date"
            value={f.ends_at}
            onChange={(e) => setF((prev) => ({ ...prev, ends_at: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      <p className="text-xs text-text-lo">Leave dates empty to run indefinitely until paused.</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Banners appended below signatures at send-time — no template editing needed."
        icon="solar:flag-broken"
        actions={[{ label: "New campaign", icon: "solar:add-circle-broken", variant: "primary", onClick: () => setShowAdd(true) }]}
      />

      {!loading && campaigns.length === 0 && (
        <GenericEmptyState
          icon="solar:flag-broken"
          title="No campaigns yet"
          description="Add a banner to run on staff signatures — target everyone or a specific domain, with an optional date range."
          action={{ label: "New campaign", onClick: () => setShowAdd(true) }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const stats = totals[campaign.id] || { impressions: 0, clicks: 0 };
          const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(1) : "0.0";
          const domain = campaign.domain_id ? domainById.get(campaign.domain_id) : null;
          return (
            <div key={campaign.id} className="rounded-2xl border border-app-border bg-surface p-4 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={campaign.image_url} alt={campaign.name} className="mb-3 h-24 w-full rounded-lg border border-app-border object-cover" />
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="truncate font-medium text-text-hi">{campaign.name}</p>
                <button
                  onClick={() => toggleActive(campaign)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    campaign.active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {campaign.active ? "Active" : "Paused"}
                </button>
              </div>
              <p className="mb-3 text-xs text-text-lo">
                {domain ? domain.name : "All domains"}
                {campaign.starts_at || campaign.ends_at ? (
                  <> · {campaign.starts_at?.slice(0, 10) || "any time"} → {campaign.ends_at?.slice(0, 10) || "ongoing"}</>
                ) : (
                  " · Runs indefinitely"
                )}
              </p>
              <div className="mb-3 flex items-center gap-4 text-xs text-text-lo">
                <span>{stats.impressions} impressions</span>
                <span>{stats.clicks} clicks</span>
                <span>{ctr}% CTR</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEdit(campaign)}
                  className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi transition-colors hover:bg-surface-2"
                >
                  <Icon icon="solar:pen-broken" className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(campaign)}
                  className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-status-danger transition-colors hover:bg-status-danger/10"
                >
                  <Icon icon="solar:trash-bin-trash-broken" className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SimpleModal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New campaign" width="max-w-md">
        <div className="space-y-4">
          <FormFields f={form} setF={setForm} />
          <Button className="w-full" onClick={addCampaign} disabled={!canSubmit(form) || saving}>
            {saving ? "Creating…" : "Create campaign"}
          </Button>
        </div>
      </SimpleModal>

      <SimpleModal
        isOpen={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          setEditForm(null);
        }}
        title={`Edit ${editTarget?.name ?? "campaign"}`}
        width="max-w-md"
      >
        {editForm && (
          <div className="space-y-4">
            <FormFields f={editForm} setF={(updater) => setEditForm((prev) => (prev ? updater(prev) : prev))} />
            <Button className="w-full" onClick={saveEdit} disabled={!canSubmit(editForm) || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </SimpleModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete campaign?"
        message={`Delete "${deleteTarget?.name}"? Its stats will be deleted too. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteCampaign}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
