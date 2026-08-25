"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
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
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/templates").then((r) => r.json());
    setTemplates(res.templates || []);
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => router.push(`/templates/${template.id}`)}
            className="flex flex-col rounded-2xl border border-app-border bg-surface p-4 text-left shadow-sm transition-colors hover:bg-surface-2"
          >
            <div className="mb-3 overflow-hidden rounded-lg border border-app-border bg-white p-3">
              <div className="pointer-events-none max-h-32 scale-[0.85] origin-top-left overflow-hidden text-black" dangerouslySetInnerHTML={{ __html: template.html }} />
            </div>
            <p className="font-medium text-text-hi">{template.name}</p>
            {template.description && <p className="mt-0.5 line-clamp-2 text-xs text-text-lo">{template.description}</p>}
            <p className="mt-2 flex items-center gap-1 text-xs text-text-lo">
              <Icon icon="solar:clock-circle-broken" className="h-3.5 w-3.5" />
              Updated {new Date(template.updated_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
