"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import SimpleModal from "@/shared/ui/SimpleModal";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import Button from "@/shared/ui/Button";
import GenericEmptyState from "@/shared/ui/EmptyState";
import MediaPicker from "@/shared/ui/MediaPicker";

interface Domain {
  id: string;
  name: string;
  gateway_status: "not_configured" | "pending_dns" | "active" | "error";
}

interface Template {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  template_id: string;
  deploy_status: "pending" | "deployed" | "error";
  last_deployed_at: string | null;
  gmail_sync_status: "pending" | "synced" | "error" | "not_applicable";
  gmail_sync_error: string | null;
  last_gmail_synced_at: string | null;
  updated_at: string;
}

// A "pending" assignment older than this has likely gone unnoticed rather than just be waiting
// on the person's next outgoing email — surface it instead of leaving it silently stuck.
const STUCK_PENDING_HOURS = 24;

function isStuckPending(assignment: Assignment | null): boolean {
  if (!assignment || assignment.deploy_status !== "pending") return false;
  const ageMs = Date.now() - new Date(assignment.updated_at).getTime();
  return ageMs > STUCK_PENDING_HOURS * 60 * 60 * 1000;
}

interface Staff {
  id: string;
  domain_id: string;
  email: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
  status: "active" | "suspended";
  signature_assignments: Assignment[] | Assignment | null;
}

const STATUS_STYLE: Record<string, string> = {
  deployed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

const GMAIL_STATUS_STYLE: Record<string, string> = {
  synced: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  not_applicable: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function assignmentOf(staff: Staff): Assignment | null {
  if (!staff.signature_assignments) return null;
  return Array.isArray(staff.signature_assignments) ? staff.signature_assignments[0] ?? null : staff.signature_assignments;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external URLs of arbitrary hosts aren't allowlisted for next/image
    return <img src={photoUrl} alt={name} width={28} height={28} className="h-7 w-7 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-semibold text-brand-600">
      {initials(name)}
    </span>
  );
}

function PhotoField({ value, onChange, name }: { value: string; onChange: (url: string) => void; name: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name || "?"} photoUrl={value || null} />
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-surface px-3 py-1.5 text-xs font-medium text-text-hi transition-colors hover:bg-surface-2"
      >
        <Icon icon="solar:camera-broken" className="h-3.5 w-3.5" />
        {value ? "Change photo" : "Choose photo"}
      </button>
      <MediaPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={onChange} />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-xs font-medium text-text-lo hover:text-status-danger">
          Remove
        </button>
      )}
    </div>
  );
}

interface StaffForm {
  domain_id: string;
  email: string;
  full_name: string;
  role_title: string;
  department: string;
  phone: string;
  mobile: string;
  photo_url: string;
  template_id: string;
}

const EMPTY_FORM: StaffForm = {
  domain_id: "",
  email: "",
  full_name: "",
  role_title: "",
  department: "",
  phone: "",
  mobile: "",
  photo_url: "",
  template_id: "",
};

function StaffFormFields({
  form,
  setForm,
  domains,
  templates,
  showDomainField,
}: {
  form: StaffForm;
  setForm: (updater: (f: StaffForm) => StaffForm) => void;
  domains: Domain[];
  templates: Template[];
  showDomainField: boolean;
}) {
  const selectedDomain = domains.find((d) => d.id === form.domain_id);

  return (
    <div className="space-y-4">
      {showDomainField && (
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Domain</label>
          <select
            value={form.domain_id}
            onChange={(e) => {
              const newDomain = domains.find((d) => d.id === e.target.value);
              setForm((f) => {
                const localPart = f.email.includes("@") ? f.email.slice(0, f.email.indexOf("@")) : f.email;
                return { ...f, domain_id: e.target.value, email: newDomain && localPart ? `${localPart}@${newDomain.name}` : f.email };
              });
            }}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="" disabled>
              Select domain
            </option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {selectedDomain && selectedDomain.gateway_status !== "active" && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Icon icon="solar:danger-triangle-broken" className="h-3.5 w-3.5 shrink-0" />
              This domain&apos;s mail gateway isn&apos;t active yet — signatures won&apos;t deploy until it is.
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Full name</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Email</label>
          {selectedDomain ? (
            <div className="flex items-stretch overflow-hidden rounded-lg border border-app-border bg-surface focus-within:ring-2 focus-within:ring-brand-500">
              <input
                value={form.email.endsWith(`@${selectedDomain.name}`) ? form.email.slice(0, -(selectedDomain.name.length + 1)) : form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: `${e.target.value}@${selectedDomain.name}` }))}
                placeholder="jane.wanjiru"
                className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-text-hi outline-none"
              />
              <span className="flex shrink-0 items-center bg-surface-2 px-3 text-sm text-text-lo">@{selectedDomain.name}</span>
            </div>
          ) : (
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@yourcompany.com"
              className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Role / title</label>
          <input
            value={form.role_title}
            onChange={(e) => setForm((f) => ({ ...f, role_title: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Department</label>
          <input
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Mobile</label>
          <input
            value={form.mobile}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-text-hi">Photo</label>
          <PhotoField value={form.photo_url} onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))} name={form.full_name} />
        </div>
        {showDomainField && (
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-text-hi">Signature template</label>
            <select
              value={form.template_id}
              onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
              className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">None yet</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={null}>
      <StaffPageInner />
    </Suspense>
  );
}

function StaffPageInner() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [syncingGmailId, setSyncingGmailId] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<Staff | null>(null);
  const [copyPreviewHtml, setCopyPreviewHtml] = useState<string | null>(null);
  const [loadingCopyPreview, setLoadingCopyPreview] = useState(false);
  const [copyView, setCopyView] = useState<"preview" | "html">("preview");
  const [syncingAllGmail, setSyncingAllGmail] = useState(false);
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState<StaffForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const router = useRouter();
  const handledNewParam = useRef(false);
  const searchParams = useSearchParams();

  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    const [staffRes, domainsRes, templatesRes] = await Promise.all([
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    setStaff(staffRes.staff || []);
    setDomains(domainsRes.domains || []);
    setTemplates(templatesRes.templates || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1" && !handledNewParam.current) {
      handledNewParam.current = true;
      router.replace("/staff");
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains]);

  const canSubmit = useMemo(() => form.domain_id && form.email.trim() && form.full_name.trim(), [form]);

  const visibleStaff = useMemo(() => {
    if (!searchQuery.trim()) return staff;
    const q = searchQuery.trim().toLowerCase();
    return staff.filter((s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [staff, searchQuery]);

  const addStaff = async () => {
    if (adding) return;
    setAdding(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAdding(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to add staff member");
      return;
    }
    toast.success("Staff member added");
    setShowAdd(false);
    setForm(EMPTY_FORM);
    load();
  };

  const assignTemplate = async (staffId: string, templateId: string) => {
    const res = await fetch(`/api/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: templateId }),
    });
    if (!res.ok) {
      toast.error("Failed to assign template");
      return;
    }
    load();
  };

  const openEdit = (person: Staff) => {
    setEditTarget(person);
    setEditForm({
      domain_id: person.domain_id,
      email: person.email,
      full_name: person.full_name,
      role_title: person.role_title || "",
      department: person.department || "",
      phone: person.phone || "",
      mobile: person.mobile || "",
      photo_url: person.photo_url || "",
      template_id: assignmentOf(person)?.template_id || "",
    });
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm) return;
    setSavingEdit(true);
    const res = await fetch(`/api/staff/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: editForm.full_name,
        email: editForm.email,
        role_title: editForm.role_title || null,
        department: editForm.department || null,
        phone: editForm.phone || null,
        mobile: editForm.mobile || null,
        photo_url: editForm.photo_url || null,
      }),
    });
    setSavingEdit(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to save staff member");
      return;
    }
    toast.success("Staff member updated");
    setEditTarget(null);
    setEditForm(null);
    load();
  };

  const toggleStatus = async (person: Staff) => {
    const nextStatus = person.status === "active" ? "suspended" : "active";
    setStaff((prev) => prev.map((s) => (s.id === person.id ? { ...s, status: nextStatus } : s)));
    const res = await fetch(`/api/staff/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      load();
      return;
    }
    toast.success(nextStatus === "suspended" ? "Staff member suspended" : "Staff member reactivated");
  };

  const deleteStaff = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/staff/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete staff member");
      return;
    }
    toast.success("Staff member deleted");
    setDeleteTarget(null);
    setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === visibleStaff.length ? new Set() : new Set(visibleStaff.map((s) => s.id))));
  };

  const applyBulkTemplate = async () => {
    if (!bulkTemplateId || selectedIds.size === 0) return;
    setBulkApplying(true);
    const res = await fetch("/api/staff/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_ids: Array.from(selectedIds), template_id: bulkTemplateId }),
    });
    setBulkApplying(false);
    if (!res.ok) {
      toast.error("Failed to apply template");
      return;
    }
    toast.success(`Template applied to ${selectedIds.size} staff member${selectedIds.size === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    setBulkTemplateId("");
    load();
  };

  const bulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => fetch(`/api/staff/${id}`, { method: "DELETE" })));
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) toast.error(`Failed to delete ${failed} of ${ids.length}`);
    else toast.success(`Deleted ${ids.length} staff member${ids.length === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    load();
  };

  const syncGmail = async (staffId: string) => {
    setSyncingGmailId(staffId);
    const res = await fetch(`/api/staff/${staffId}/sync-gmail`, { method: "POST" });
    setSyncingGmailId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to push signature to Gmail");
      load();
      return;
    }
    toast.success("Signature pushed to their Gmail settings");
    load();
  };

  const syncAllGmail = async () => {
    setSyncingAllGmail(true);
    const res = await fetch("/api/staff/sync-gmail", { method: "POST" });
    setSyncingAllGmail(false);
    if (!res.ok) {
      toast.error("Failed to sync signatures to Gmail");
      return;
    }
    const body = await res.json();
    if (body.succeeded === body.total) toast.success(`Pushed to Gmail for all ${body.total} staff members`);
    else toast.error(`Pushed ${body.succeeded} of ${body.total} — check individual rows for errors`);
    load();
  };

  const openCopyPreview = async (person: Staff) => {
    setCopyTarget(person);
    setCopyPreviewHtml(null);
    setCopyView("preview");
    setLoadingCopyPreview(true);
    const res = await fetch(`/api/staff/${person.id}/signature-html`);
    setLoadingCopyPreview(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to load signature");
      setCopyTarget(null);
      return;
    }
    const { html } = await res.json();
    setCopyPreviewHtml(html);
  };

  const copySignature = async () => {
    if (!copyPreviewHtml) return;
    try {
      // Rich-content copy so pasting into a webmail/mail-client signature field lands as
      // formatted HTML, not a wall of raw markup — the manual-paste path for domains with no
      // automated deployment (no Workspace, no server-level mail access).
      if (navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([copyPreviewHtml], { type: "text/html" }),
            "text/plain": new Blob([copyPreviewHtml], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(copyPreviewHtml);
      }
      toast.success("Signature copied — paste into their mailbox's signature settings");
      setCopyTarget(null);
    } catch {
      toast.error("Couldn't access clipboard — try again or check browser permissions");
    }
  };

  const retryDeploy = async (staffId: string) => {
    setRetryingId(staffId);
    const res = await fetch(`/api/staff/${staffId}/retry-deploy`, { method: "POST" });
    setRetryingId(null);
    if (!res.ok) {
      toast.error("Failed to retry");
      return;
    }
    toast.success("Marked pending — takes effect on their next outgoing email");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Everyone whose outgoing mail should carry a signature."
        icon="solar:users-group-rounded-broken"
        actions={[
          {
            label: syncingAllGmail ? "Syncing…" : "Sync all to Gmail",
            icon: "logos:google-gmail",
            onClick: syncAllGmail,
            disabled: syncingAllGmail || staff.length === 0,
            className:
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-app-border bg-surface text-text-hi hover:bg-surface-2 transition-colors disabled:opacity-50",
          },
          { label: "Add staff", icon: "solar:user-plus-broken", variant: "primary", onClick: () => setShowAdd(true), disabled: domains.length === 0 },
        ]}
      />

      {!loading && domains.length === 0 && (
        <GenericEmptyState
          icon="solar:global-broken"
          title="Add a domain first"
          description="Staff belong to a domain, so you'll need at least one domain before adding people."
          action={{ label: "Go to domains", onClick: () => (window.location.href = "/domains") }}
        />
      )}

      {!loading && domains.length > 0 && staff.length === 0 && (
        <GenericEmptyState
          icon="solar:users-group-rounded-broken"
          title="No staff yet"
          description="Add your first team member to assign them a signature template."
          action={{ label: "Add staff", onClick: () => setShowAdd(true) }}
        />
      )}

      {staff.length > 0 && (
        <div className="mb-3 relative max-w-xs">
          <Icon icon="solar:magnifer-broken" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-app-border bg-surface py-2 pl-9 pr-3 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-surface-2 px-4 py-2.5">
          <span className="text-sm font-medium text-text-hi">{selectedIds.size} selected</span>
          <select
            value={bulkTemplateId}
            onChange={(e) => setBulkTemplateId(e.target.value)}
            className="rounded-lg border border-app-border bg-surface px-2 py-1.5 text-xs text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="" disabled>
              Choose template
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={applyBulkTemplate}
            disabled={!bulkTemplateId || bulkApplying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {bulkApplying && <Icon icon="solar:loading-bold" className="h-3.5 w-3.5 animate-spin" />}
            Apply to {selectedIds.size}
          </button>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-status-danger/30 px-3 py-1.5 text-xs font-medium text-status-danger transition-colors hover:bg-status-danger/10"
          >
            <Icon icon="solar:trash-bin-trash-broken" className="h-3.5 w-3.5" />
            Delete {selectedIds.size}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs font-medium text-text-lo hover:text-text-hi">
            Clear
          </button>
        </div>
      )}

      {visibleStaff.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-app-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-app-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-lo">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.size === visibleStaff.length} onChange={toggleSelectAll} className="rounded border-app-border" />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Gmail</th>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((person) => {
                const assignment = assignmentOf(person);
                const domain = domainById.get(person.domain_id);
                const domainInactive = domain && domain.gateway_status !== "active";
                const stuck = isStuckPending(assignment);
                const suspended = person.status === "suspended";
                return (
                  <tr key={person.id} className={`border-b border-app-border last:border-0 ${suspended ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(person.id)}
                        onChange={() => toggleSelected(person.id)}
                        className="rounded border-app-border"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-text-hi">
                      <div className="flex items-center gap-2">
                        <Avatar name={person.full_name} photoUrl={person.photo_url} />
                        <span>{person.full_name}</span>
                        {suspended && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            Suspended
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-lo">{person.email}</td>
                    <td className="px-4 py-3 text-text-lo">
                      {person.role_title}
                      {person.department ? ` · ${person.department}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={assignment?.template_id ?? ""}
                        onChange={(e) => assignTemplate(person.id, e.target.value)}
                        className="rounded-lg border border-app-border bg-surface px-2 py-1.5 text-xs text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="" disabled>
                          Select template
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${GMAIL_STATUS_STYLE[assignment?.gmail_sync_status ?? "not_applicable"]}`}
                          title={assignment?.gmail_sync_error || undefined}
                        >
                          {assignment ? assignment.gmail_sync_status.replace("_", " ") : "unassigned"}
                        </span>
                        {assignment && (
                          <button
                            onClick={() => syncGmail(person.id)}
                            disabled={syncingGmailId === person.id}
                            className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                            title="Push this signature directly into their Gmail settings — takes effect immediately, but only for Gmail web/app"
                          >
                            {syncingGmailId === person.id ? "Syncing…" : "Sync"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[assignment?.deploy_status ?? "pending"]}`}
                          title={
                            assignment?.deploy_status === "pending"
                              ? "Only resolves once this person sends real mail while their domain's Outbound Gateway is enabled in Google Admin console — it may be off, in which case this stays pending indefinitely by design."
                              : undefined
                          }
                        >
                          {assignment ? assignment.deploy_status : "unassigned"}
                        </span>
                        {domainInactive && (
                          <span title={`Domain "${domain?.name}" gateway isn't active — signatures won't deploy until it is.`}>
                            <Icon icon="solar:danger-triangle-broken" className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                        {stuck && (
                          <span title={`Pending for over ${STUCK_PENDING_HOURS}h — the gateway may not be picking this up.`}>
                            <Icon icon="solar:clock-circle-broken" className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                        {(assignment?.deploy_status === "error" || stuck) && (
                          <button
                            onClick={() => retryDeploy(person.id)}
                            disabled={retryingId === person.id}
                            className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                            title="Marks pending again — takes effect on their next outgoing email"
                          >
                            {retryingId === person.id ? "Retrying…" : "Retry"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleStatus(person)}
                          className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
                          title={suspended ? "Reactivate" : "Suspend"}
                        >
                          <Icon icon={suspended ? "solar:play-circle-broken" : "solar:pause-circle-broken"} className="h-4 w-4" />
                        </button>
                        {assignment && (
                          <button
                            onClick={() => openCopyPreview(person)}
                            className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
                            title="Copy signature HTML — for manually pasting into a mailbox that isn't auto-deployed (e.g. no Google Workspace)"
                          >
                            <Icon icon="solar:copy-broken" className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(person)}
                          className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
                          title="Edit"
                        >
                          <Icon icon="solar:pen-broken" className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(person)}
                          className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-status-danger/10 hover:text-status-danger"
                          title="Delete"
                        >
                          <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SimpleModal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add staff member" width="max-w-lg">
        <div className="space-y-4">
          <StaffFormFields form={form} setForm={setForm} domains={domains} templates={templates} showDomainField />
          <Button className="w-full" onClick={addStaff} disabled={!canSubmit || adding}>
            <Icon icon="solar:user-plus-broken" className="h-4 w-4" />
            {adding ? "Adding…" : "Add staff member"}
          </Button>
        </div>
      </SimpleModal>

      <SimpleModal
        isOpen={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          setEditForm(null);
        }}
        title={`Edit ${editTarget?.full_name ?? "staff member"}`}
        width="max-w-lg"
      >
        {editForm && (
          <div className="space-y-4">
            <StaffFormFields
              form={editForm}
              setForm={(updater) => setEditForm((f) => (f ? updater(f) : f))}
              domains={domains}
              templates={templates}
              showDomainField={false}
            />
            <Button className="w-full" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
      </SimpleModal>

      <SimpleModal
        isOpen={!!copyTarget}
        onClose={() => setCopyTarget(null)}
        title={`Copy signature — ${copyTarget?.full_name ?? ""}`}
        subtitle="Paste this into their mailbox's signature settings (webmail or mail client)."
        width="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-app-border p-0.5">
            <button
              onClick={() => setCopyView("preview")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                copyView === "preview" ? "bg-brand-500 text-white" : "text-text-lo hover:text-text-hi"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setCopyView("html")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                copyView === "html" ? "bg-brand-500 text-white" : "text-text-lo hover:text-text-hi"
              }`}
            >
              HTML source
            </button>
          </div>

          {copyView === "preview" ? (
            <div className="min-h-[120px] overflow-x-auto rounded-lg border border-app-border bg-white p-4 text-black">
              {loadingCopyPreview ? (
                <p className="text-sm text-gray-400">Loading preview…</p>
              ) : copyPreviewHtml ? (
                <div dangerouslySetInnerHTML={{ __html: copyPreviewHtml }} />
              ) : (
                <p className="text-sm text-gray-400">No preview available.</p>
              )}
            </div>
          ) : (
            <pre className="max-h-80 overflow-auto rounded-lg border border-app-border bg-surface-2 p-4 text-xs text-text-hi">
              <code>{loadingCopyPreview ? "Loading…" : copyPreviewHtml || "No HTML available."}</code>
            </pre>
          )}

          <Button className="w-full" onClick={copySignature} disabled={!copyPreviewHtml || loadingCopyPreview}>
            <Icon icon="solar:copy-broken" className="h-4 w-4" />
            Copy signature
          </Button>
        </div>
      </SimpleModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete staff member?"
        message={`Delete "${deleteTarget?.full_name}"? Their signature assignment will be removed too. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteStaff}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} staff members?`}
        message={bulkDeleting ? "Deleting…" : "This can't be undone."}
        confirmLabel="Delete"
        onConfirm={bulkDelete}
        onClose={() => setShowBulkDeleteConfirm(false)}
      />
    </div>
  );
}
