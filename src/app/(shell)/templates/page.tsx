"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Reorder } from "framer-motion";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import GenericEmptyState from "@/shared/ui/EmptyState";
import { DEFAULT_TEMPLATE_HTML } from "@/features/signatures/lib/defaultTemplate";

interface Template {
  id: string;
  name: string;
  description: string | null;
  html: string;
  updated_at: string;
  sort_order: number;
}

type SortBy = "manual" | "name" | "updated";

function TemplateCardMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
      >
        <Icon icon="solar:menu-dots-bold" className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-app-border bg-surface shadow-lg">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDuplicate();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-hi hover:bg-surface-2"
          >
            <Icon icon="solar:copy-broken" className="h-4 w-4" />
            Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-status-danger hover:bg-status-danger/10"
          >
            <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const router = useRouter();
  const reorderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/templates").then((r) => r.json());
    setTemplates(res.templates || []);
    setUsageCounts(res.usageCounts || {});
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createTemplate = async () => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled template", html: DEFAULT_TEMPLATE_HTML }),
    });
    if (!res.ok) {
      toast.error("Failed to create template");
      return;
    }
    const { template } = await res.json();
    router.push(`/templates/${template.id}`);
  };

  const duplicateTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to duplicate template");
      return;
    }
    toast.success("Template duplicated");
    load();
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Staff assigned to it will need a new template.`)) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete template");
      return;
    }
    toast.success("Template deleted");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const persistOrder = (ordered: Template[]) => {
    if (reorderTimeout.current) clearTimeout(reorderTimeout.current);
    reorderTimeout.current = setTimeout(() => {
      fetch("/api/templates/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: ordered.map((t) => t.id) }),
      }).catch(() => toast.error("Failed to save new order"));
    }, 500);
  };

  const visibleTemplates = useMemo(() => {
    let list = templates;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "updated") list = [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [templates, searchQuery, sortBy]);

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Signature designs staff get assigned to."
        icon="solar:pen-new-square-broken"
        actions={[{ label: "New template", icon: "solar:add-circle-broken", variant: "primary", onClick: createTemplate }]}
      />

      {!loading && templates.length === 0 && (
        <GenericEmptyState
          icon="solar:pen-new-square-broken"
          title="No templates yet"
          description="Design a signature template, then assign it to staff members."
          action={{ label: "New template", onClick: createTemplate }}
        />
      )}

      {templates.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Icon icon="solar:magnifer-broken" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-lo" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-lg border border-app-border bg-surface py-2 pl-9 pr-3 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {sortBy !== "manual" && (
              <span className="text-xs text-text-lo">Switch to Manual order to drag and reorder</span>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="manual">Manual order</option>
              <option value="name">Name (A–Z)</option>
              <option value="updated">Last updated</option>
            </select>
          </div>
        </div>
      )}

      <Reorder.Group
        as="div"
        axis="y"
        values={visibleTemplates}
        onReorder={(ordered) => {
          if (sortBy !== "manual") return;
          setTemplates(ordered);
          persistOrder(ordered);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {visibleTemplates.map((template) => (
          <Reorder.Item
            key={template.id}
            value={template}
            drag={sortBy === "manual"}
            onClick={() => router.push(`/templates/${template.id}`)}
            className="flex cursor-pointer flex-col rounded-2xl border border-app-border bg-surface p-4 text-left shadow-sm transition-colors hover:bg-surface-2"
          >
            <div className="mb-3 overflow-hidden rounded-lg border border-app-border bg-white p-3">
              <div className="pointer-events-none max-h-32 scale-[0.85] origin-top-left overflow-hidden text-black" dangerouslySetInnerHTML={{ __html: template.html }} />
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-text-hi">{template.name}</p>
                {template.description && <p className="mt-0.5 line-clamp-2 text-xs text-text-lo">{template.description}</p>}
              </div>
              <TemplateCardMenu
                onDuplicate={() => duplicateTemplate(template.id)}
                onDelete={() => deleteTemplate(template.id, template.name)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-lo">
              <span className="flex items-center gap-1">
                <Icon icon="solar:clock-circle-broken" className="h-3.5 w-3.5" />
                Updated {new Date(template.updated_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Icon icon="solar:users-group-rounded-broken" className="h-3.5 w-3.5" />
                {usageCounts[template.id] || 0}
              </span>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
