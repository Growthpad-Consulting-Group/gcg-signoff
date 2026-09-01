"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { MergeTagSource, renderSignatureHtml } from "@/features/signatures/lib/mergeTags";
import { lintSignatureHtml } from "@/features/signatures/lib/lintSignatureHtml";
import BlockEditor, { BlockEditorHandle } from "@/features/signatures/ui/BlockEditor";
import { Block } from "@/features/signatures/lib/blocks";
import VersionHistoryModal from "@/features/signatures/ui/VersionHistoryModal";
import TooltipIconButton from "@/shared/ui/TooltipIconButton";

const PREVIEW_STAFF: MergeTagSource = {
  full_name: "Jane Wanjiru",
  email: "jane.wanjiru@growthpad.co.ke",
  role_title: "Marketing Manager",
  department: "Marketing",
  phone: "+254 700 000 000",
  mobile: "+254 711 000 000",
  photo_url: "https://placehold.co/72x72/f05d23/ffffff?text=JW",
};

interface StaffOption {
  id: string;
  full_name: string;
  email: string;
  role_title: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [initialHtml, setInitialHtml] = useState("");
  const [initialBlocks, setInitialBlocks] = useState<Block[] | null>(null);
  const [initialCanvasWidth, setInitialCanvasWidth] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [previewAsId, setPreviewAsId] = useState<string>("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [forceDeleteStaffCount, setForceDeleteStaffCount] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [previewDark, setPreviewDark] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewMounted, setPreviewMounted] = useState(false);
  const [previewAnimateIn, setPreviewAnimateIn] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const loadedRef = useRef(false);
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<BlockEditorHandle>(null);

  useEffect(() => {
    (async () => {
      const [templateRes, staffRes] = await Promise.all([
        fetch(`/api/templates/${id}`),
        fetch("/api/staff").then((r) => r.json()).catch(() => ({ staff: [] })),
      ]);
      if (!templateRes.ok) {
        toast.error("Template not found");
        router.push("/templates");
        return;
      }
      const { template } = await templateRes.json();
      setName(template.name);
      setDescription(template.description || "");
      setInitialHtml(template.html || "");
      setInitialBlocks(template.blocks || null);
      setInitialCanvasWidth(template.canvas_width ?? null);
      setPreviewHtml(template.html || "");
      setStaffOptions(staffRes.staff || []);
      setLoading(false);
      // Let the autosave effect settle before treating further changes as user edits.
      setTimeout(() => {
        loadedRef.current = true;
      }, 0);
    })();
  }, [id, router]);

  // After restoring a version, re-fetch the template and force the editor to re-initialize with
  // the restored content (it only reads initial* props on mount).
  const reloadAfterRestore = async () => {
    const res = await fetch(`/api/templates/${id}`);
    if (!res.ok) return;
    const { template } = await res.json();
    setInitialHtml(template.html || "");
    setInitialBlocks(template.blocks || null);
    setInitialCanvasWidth(template.canvas_width ?? null);
    setPreviewHtml(template.html || "");
    setEditorKey((k) => k + 1);
  };

  const lintFindings = useMemo(() => lintSignatureHtml(previewHtml), [previewHtml]);

  const openPreview = () => {
    setPreviewMounted(true);
    // Mount closed first, then flip to the "in" state on the next frame so the
    // transform/opacity transition actually has something to animate from.
    requestAnimationFrame(() => requestAnimationFrame(() => setPreviewAnimateIn(true)));
  };

  const closePreview = () => {
    setPreviewAnimateIn(false);
    setTimeout(() => setPreviewMounted(false), 300);
  };

  const previewData: MergeTagSource = previewAsId
    ? staffOptions.find((s) => s.id === previewAsId) || PREVIEW_STAFF
    : PREVIEW_STAFF;

  const save = async ({ silent = false }: { silent?: boolean } = {}) => {
    const exported = editorRef.current?.getExport();
    if (!silent) setSaving(true);
    else setAutosaveStatus("saving");

    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        silent,
        ...(exported ? { html: exported.html, blocks: exported.blocks, canvas_width: exported.canvasWidth } : {}),
      }),
    });

    if (!silent) setSaving(false);

    if (!res.ok) {
      if (!silent) toast.error("Failed to save template");
      else setAutosaveStatus("idle");
      return;
    }

    if (!silent) {
      toast.success(
        "Template saved. Gateway-deployed staff will pick it up on their next outgoing email; Gmail-synced staff are being updated now."
      );
    } else {
      setAutosaveStatus("saved");
    }
  };

  const scheduleAutosave = () => {
    if (!loadedRef.current) return;
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      save({ silent: true });
    }, 1500);
  };

  useEffect(() => {
    scheduleAutosave();
    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description]);

  const deleteTemplate = async (force = false) => {
    const res = await fetch(`/api/templates/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/templates");
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && typeof body.staffCount === "number") {
      setShowDeleteConfirm(false);
      setForceDeleteStaffCount(body.staffCount);
      return;
    }
    toast.error(body.error || "Failed to delete template");
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error("Enter an email address to send to");
      return;
    }
    setSendingTest(true);
    const res = await fetch(`/api/templates/${id}/test-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail.trim(), staffId: previewAsId || undefined }),
    });
    setSendingTest(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to send test email");
      return;
    }
    toast.success(`Test email sent to ${testEmail.trim()}`);
  };

  if (loading) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      {/* Top bar — a dedicated full-viewport workspace instead of sitting inside the app's
          sidebar/header/footer chrome, matching how Unlayer/Stripo/Beefree structure their
          builders. */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-app-border bg-surface px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TooltipIconButton label="Back to templates" icon="solar:arrow-left-broken" onClick={() => router.push("/templates")} className="shrink-0" />
          <div className="h-5 w-px shrink-0 bg-app-border" />
          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled template"
              className="w-full truncate bg-transparent text-sm font-semibold text-text-hi outline-none placeholder:text-text-lo"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description…"
              className="w-full truncate bg-transparent text-xs text-text-lo outline-none"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {autosaveStatus !== "idle" && (
            <span className="hidden items-center gap-1 text-xs font-normal text-text-lo sm:flex">
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
          <TooltipIconButton
            label="Undo (Ctrl/Cmd+Z)"
            icon="solar:undo-left-broken"
            onClick={() => editorRef.current?.undo()}
            disabled={!canUndo}
          />
          <TooltipIconButton
            label="Redo (Ctrl/Cmd+Shift+Z)"
            icon="solar:undo-right-broken"
            onClick={() => editorRef.current?.redo()}
            disabled={!canRedo}
          />
          <div className="h-5 w-px bg-app-border" />
          <TooltipIconButton label="Version history" icon="solar:history-broken" onClick={() => setShowHistory(true)} />
          <TooltipIconButton
            label="Delete template"
            icon="solar:trash-bin-trash-broken"
            onClick={() => setShowDeleteConfirm(true)}
            className="hover:!bg-status-danger/10 hover:!text-status-danger"
          />
          <button
            onClick={openPreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-surface px-3 py-1.5 text-sm font-medium text-text-hi transition-colors hover:bg-surface-2"
          >
            <Icon icon="solar:eye-broken" className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={() => save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? <Icon icon="solar:loading-bold" className="h-4 w-4 animate-spin" /> : <Icon icon="solar:diskette-broken" className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <BlockEditor
          key={editorKey}
          ref={editorRef}
          templateId={id}
          initialBlocks={initialBlocks}
          initialHtml={initialHtml}
          initialCanvasWidth={initialCanvasWidth}
          onChange={(_blocks, html) => {
            setPreviewHtml(html);
            scheduleAutosave();
          }}
          onHistoryChange={(undoAvailable, redoAvailable) => {
            setCanUndo(undoAvailable);
            setCanRedo(redoAvailable);
          }}
        />
      </div>

      {previewMounted && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${previewAnimateIn ? "opacity-100" : "opacity-0"}`}
            onClick={closePreview}
          />
          <div
            className={`relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-app-border bg-canvas p-4 shadow-xl transition-transform duration-300 ease-out ${previewAnimateIn ? "translate-x-0" : "translate-x-full"}`}
          >

          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-text-hi">
              <Icon icon="solar:eye-broken" className="h-4 w-4" />
              Live preview
            </div>
            <button
              onClick={closePreview}
              className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
            >
              <Icon icon="solar:close-circle-broken" className="h-5 w-5" />
            </button>
          </div>

          <select
            value={previewAsId}
            onChange={(e) => setPreviewAsId(e.target.value)}
            className="mb-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Sample data (Jane Wanjiru)</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>

          <div className="mb-2 flex items-center gap-1.5">
            <button
              onClick={() => setPreviewDark((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                previewDark ? "border-brand-500 bg-brand-500/10 text-brand-600" : "border-app-border bg-surface text-text-lo hover:text-text-hi"
              }`}
            >
              <Icon icon="solar:moon-broken" className="h-3.5 w-3.5" />
              Dark
            </button>
            <button
              onClick={() => setPreviewMobile((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                previewMobile ? "border-brand-500 bg-brand-500/10 text-brand-600" : "border-app-border bg-surface text-text-lo hover:text-text-hi"
              }`}
            >
              <Icon icon="solar:smartphone-broken" className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>

          <div className={`mx-auto w-full flex-1 overflow-auto rounded-lg border border-app-border p-4 transition-all ${previewDark ? "bg-gray-900" : "bg-white"} ${previewMobile ? "max-w-[375px]" : ""}`} style={{ minHeight: 300 }}>
            <div className={previewDark ? "text-white" : "text-black"} dangerouslySetInnerHTML={{ __html: renderSignatureHtml(previewHtml, previewData) }} />
          </div>
          <p className="mb-2 mt-1 text-xs text-text-lo">
            {previewAsId ? "Rendered with this staff member's real details." : "Rendered with sample data."}
          </p>

          <div className={`mb-2 rounded-lg border p-2.5 text-xs ${lintFindings.length === 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10" : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10"}`}>
            {lintFindings.length === 0 ? (
              <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Icon icon="solar:check-circle-broken" className="h-3.5 w-3.5 shrink-0" />
                No compatibility or accessibility issues found.
              </p>
            ) : (
              <ul className="space-y-1">
                {lintFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                    <Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {f.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Send a test to..."
              className="flex-1 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={sendTestEmail}
              disabled={sendingTest}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm font-medium text-text-hi transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {sendingTest ? (
                <Icon icon="solar:loading-bold" className="h-4 w-4 animate-spin" />
              ) : (
                <Icon icon="solar:letter-broken" className="h-4 w-4" />
              )}
              Send test
            </button>
          </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete template?"
        message={`Delete "${name}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTemplate()}
        onClose={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={forceDeleteStaffCount !== null}
        title="Template is assigned to staff"
        message={`"${name}" is assigned to ${forceDeleteStaffCount} staff member${forceDeleteStaffCount === 1 ? "" : "s"} — deleting it will unassign them (they'll show as "unassigned" until given a new template).`}
        confirmLabel="Delete anyway"
        onConfirm={() => deleteTemplate(true)}
        onClose={() => setForceDeleteStaffCount(null)}
      />

      <VersionHistoryModal
        templateId={id}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onRestored={reloadAfterRestore}
      />
    </div>
  );
}
