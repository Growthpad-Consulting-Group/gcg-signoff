"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PageHeader from "@/shared/ui/PageHeader";
import { MERGE_TAGS, renderSignatureHtml } from "@/features/signatures/lib/mergeTags";

const PREVIEW_STAFF = {
  full_name: "Jane Wanjiru",
  email: "jane.wanjiru@growthpad.co.ke",
  role_title: "Marketing Manager",
  department: "Marketing",
  phone: "+254 700 000 000",
  mobile: "+254 711 000 000",
  photo_url: "https://placehold.co/72x72/f05d23/ffffff?text=JW",
};

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedRef = useRef(false);
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) {
        toast.error("Template not found");
        router.push("/templates");
        return;
      }
      const { template } = await res.json();
      setName(template.name);
      setDescription(template.description || "");
      setHtml(template.html);
      setLoading(false);
      // Let the autosave effect settle before treating further changes as user edits.
      setTimeout(() => {
        loadedRef.current = true;
      }, 0);
    })();
  }, [id, router]);

  const save = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setSaving(true);
    else setAutosaveStatus("saving");

    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, html }),
    });

    if (!silent) setSaving(false);

    if (!res.ok) {
      if (!silent) toast.error("Failed to save template");
      else setAutosaveStatus("idle");
      return;
    }

    if (!silent) {
      toast.success("Template saved. Assigned staff will re-deploy on next sync.");
    } else {
      setAutosaveStatus("saved");
    }
  };

  useEffect(() => {
    if (!loadedRef.current) return;
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      save({ silent: true });
    }, 1500);
    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, html]);

  const deleteTemplate = async () => {
    if (!confirm(`Delete "${name}"? Staff assigned to it will need a new template.`)) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete template");
      return;
    }
    router.push("/templates");
  };

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    const insertion = `{{${tag}}}`;

    if (!textarea) {
      setHtml((h) => `${h}${insertion}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setHtml((h) => h.slice(0, start) + insertion + h.slice(end));

    requestAnimationFrame(() => {
      const caret = start + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  };

  if (loading) return null;

  return (
    <div>
      <PageHeader
        title={name || "Untitled template"}
        description="Editing signature HTML — merge tags render with each staff member's own details."
        icon="solar:pen-new-square-broken"
        actions={[{ label: "Delete", icon: "solar:trash-bin-trash-broken", onClick: deleteTemplate, className: "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-app-border bg-surface text-status-danger hover:bg-status-danger/10 transition-colors" }]}
        saveAction={{ onSave: save, loading: saving, label: "Save template" }}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Template name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-hi">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — e.g. which team this is for"
            className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-lo">Insert merge tag:</span>
        {MERGE_TAGS.map((t) => (
          <button
            key={t.tag}
            onClick={() => insertTag(t.tag)}
            className="rounded-full border border-app-border bg-surface px-2.5 py-1 text-xs font-medium text-text-hi hover:bg-surface-2"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-medium text-text-hi">
            <span className="flex items-center gap-1.5">
              <Icon icon="solar:code-square-broken" className="h-4 w-4" />
              HTML source
            </span>
            {autosaveStatus !== "idle" && (
              <span className="flex items-center gap-1 text-xs font-normal text-text-lo">
                {autosaveStatus === "saving" ? (
                  <>
                    <Icon icon="solar:loading-bold" className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-broken" className="h-3.5 w-3.5" />
                    Saved
                  </>
                )}
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            className="h-[480px] w-full rounded-lg border border-app-border bg-surface-2 p-3 font-mono text-xs text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-text-lo">
            Use table-based, inlined-style HTML — Outlook and most mobile clients ignore flexbox/grid and external CSS.
          </p>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text-hi">
            <Icon icon="solar:eye-broken" className="h-4 w-4" />
            Live preview
          </div>
          <div className="h-[480px] overflow-auto rounded-lg border border-app-border bg-white p-4 text-black">
            <div dangerouslySetInnerHTML={{ __html: renderSignatureHtml(html, PREVIEW_STAFF) }} />
          </div>
          <p className="mt-1 text-xs text-text-lo">Rendered with sample data — actual signatures pull each person&apos;s real details.</p>
        </div>
      </div>
    </div>
  );
}
