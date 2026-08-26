"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import GenericEmptyState from "@/shared/ui/EmptyState";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
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

function TemplateCard({
  template,
  usageCount,
  dragDisabled,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  template: Template;
  usageCount: number;
  dragDisabled: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
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
        <TemplateCardMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-text-lo">
        <span className="flex items-center gap-1">
          <Icon icon="solar:clock-circle-broken" className="h-3.5 w-3.5" />
          Updated {new Date(template.updated_at).toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1">
          <Icon icon="solar:users-group-rounded-broken" className="h-3.5 w-3.5" />
          {usageCount}
        </span>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesPageInner />
    </Suspense>
  );
}

function TemplatesPageInner() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const router = useRouter();
  const searchParams = useSearchParams();
  const reorderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  // Dashboard "New template" quick action deep-links here with ?new=1 instead of a modal, since
  // this page creates immediately and navigates rather than showing an Add form.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      router.replace("/templates");
      createTemplate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const duplicateTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to duplicate template");
      return;
    }
    toast.success("Template duplicated");
    load();
  };

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete template");
      return;
    }
    toast.success("Template deleted");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeleteTarget(null);
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

  const dragEnabled = sortBy === "manual" && !searchQuery.trim();

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

  const handleDragEnd = (event: DragEndEvent) => {
    if (!dragEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(templates, oldIndex, newIndex);
    setTemplates(reordered);
    persistOrder(reordered);
  };

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
            {!dragEnabled && (
              <span className="text-xs text-text-lo">
                {sortBy !== "manual" ? "Switch to Manual order to drag and reorder" : "Clear search to drag and reorder"}
              </span>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleTemplates.map((t) => t.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                usageCount={usageCounts[template.id] || 0}
                dragDisabled={!dragEnabled}
                onOpen={() => router.push(`/templates/${template.id}`)}
                onDuplicate={() => duplicateTemplate(template.id)}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete template?"
        message={`Delete "${deleteTarget?.name}"? Staff assigned to it will need a new template.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await deleteTemplate(deleteTarget.id);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
