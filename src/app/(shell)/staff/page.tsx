"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import SimpleModal from "@/shared/ui/SimpleModal";
import Button from "@/shared/ui/Button";
import GenericEmptyState from "@/shared/ui/EmptyState";

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
}

interface Staff {
  id: string;
  domain_id: string;
  email: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  phone: string | null;
  signature_assignments: Assignment[] | Assignment | null;
}

const STATUS_STYLE: Record<string, string> = {
  deployed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

function assignmentOf(staff: Staff): Assignment | null {
  if (!staff.signature_assignments) return null;
  return Array.isArray(staff.signature_assignments) ? staff.signature_assignments[0] ?? null : staff.signature_assignments;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    domain_id: "",
    email: "",
    full_name: "",
    role_title: "",
    department: "",
    phone: "",
    template_id: "",
  });

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

  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains]);
  const selectedDomain = domains.find((d) => d.id === form.domain_id);

  const canSubmit = useMemo(() => form.domain_id && form.email.trim() && form.full_name.trim(), [form]);

  const addStaff = async () => {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to add staff member");
      return;
    }
    toast.success("Staff member added");
    setShowAdd(false);
    setForm({ domain_id: "", email: "", full_name: "", role_title: "", department: "", phone: "", template_id: "" });
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

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === staff.length ? new Set() : new Set(staff.map((s) => s.id))));
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
        actions={[{ label: "Add staff", icon: "solar:user-plus-broken", variant: "primary", onClick: () => setShowAdd(true), disabled: domains.length === 0 }]}
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
          <button onClick={() => setSelectedIds(new Set())} className="text-xs font-medium text-text-lo hover:text-text-hi">
            Clear
          </button>
        </div>
      )}

      {staff.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-app-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-app-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-lo">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.size === staff.length} onChange={toggleSelectAll} className="rounded border-app-border" />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => {
                const assignment = assignmentOf(person);
                const domain = domainById.get(person.domain_id);
                const domainInactive = domain && domain.gateway_status !== "active";
                return (
                  <tr key={person.id} className="border-b border-app-border last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(person.id)}
                        onChange={() => toggleSelected(person.id)}
                        className="rounded border-app-border"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-text-hi">{person.full_name}</td>
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
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[assignment?.deploy_status ?? "pending"]}`}>
                          {assignment ? assignment.deploy_status : "unassigned"}
                        </span>
                        {domainInactive && (
                          <span title={`Domain "${domain?.name}" gateway isn't active — signatures won't deploy until it is.`}>
                            <Icon icon="solar:danger-triangle-broken" className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                        {assignment?.deploy_status === "error" && (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SimpleModal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add staff member" width="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-hi">Domain</label>
            <select
              value={form.domain_id}
              onChange={(e) => setForm((f) => ({ ...f, domain_id: e.target.value }))}
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
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@growthpad.co.ke"
                className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              />
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
          </div>
          <Button className="w-full" onClick={addStaff} disabled={!canSubmit}>
            <Icon icon="solar:user-plus-broken" className="h-4 w-4" />
            Add staff member
          </Button>
        </div>
      </SimpleModal>
    </div>
  );
}
