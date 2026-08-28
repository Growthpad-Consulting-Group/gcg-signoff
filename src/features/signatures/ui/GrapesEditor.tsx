"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./grapes-theme.css";
import toast from "react-hot-toast";
import { MERGE_TAGS } from "@/features/signatures/lib/mergeTags";
import { buildTrackedLinkHref, normalizeUrl } from "@/features/signatures/lib/trackedLink";
import { createBrowserSupabaseClient } from "@/shared/lib/supabase/client";

const BUCKET = "signature-assets";

// Uploads straight to Supabase Storage via a signed URL, then compresses server-side — the same
// path MediaPicker uses. GrapesJS's default `upload: "/api/uploads"` POSTs the raw file through
// our own Next.js route, which both Next's dev body-size warning and Vercel's 4.5MB production
// cap choke on for anything but small files.
async function uploadAssetForGrapes(file: File): Promise<string> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name }),
  });
  if (!signRes.ok) throw new Error("Failed to prepare upload");
  const { path, token } = await signRes.json();

  const supabase = createBrowserSupabaseClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file);
  if (uploadError) throw uploadError;

  const finalizeRes = await fetch("/api/uploads/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, filename: file.name }),
  });
  if (!finalizeRes.ok) throw new Error("Failed to process upload");
  const { url } = await finalizeRes.json();
  return url;
}

export interface GrapesEditorHandle {
  getExport: () => { html: string; css: string; projectData: unknown };
}

interface GrapesEditorProps {
  templateId: string;
  initialHtml: string;
  initialProjectData?: unknown;
  onChange: (html: string, css: string, projectData: unknown) => void;
}

const GrapesEditor = forwardRef<GrapesEditorHandle, GrapesEditorProps>(function GrapesEditor(
  { templateId, initialHtml, initialProjectData, onChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    getExport: () => {
      const editor = editorRef.current;
      if (!editor) return { html: "", css: "", projectData: null };
      return {
        html: editor.getHtml(),
        css: editor.getCss() || "",
        projectData: editor.getProjectData(),
      };
    },
  }));

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const grapesjs = (await import("grapesjs")).default;
      const presetNewsletter = (await import("grapesjs-preset-newsletter")).default;
      if (!containerRef.current) return;

      const editor = grapesjs.init({
        container: containerRef.current,
        fromElement: false,
        height: "600px",
        storageManager: false,
        assetManager: {
          autoAdd: true,
          uploadFile: (e: DragEvent) => {
            const fileList = e.dataTransfer ? e.dataTransfer.files : (e.target as HTMLInputElement)?.files;
            const files = Array.from(fileList || []);
            if (files.length === 0) return Promise.resolve();

            // A custom `uploadFile` bypasses GrapesJS's own upload UI/progress entirely (per
            // their docs), and the sign -> upload -> compress round trip can take several
            // seconds for a large file — without this the screen just sits there looking stuck.
            const toastId = toast.loading(files.length > 1 ? "Uploading images…" : "Uploading image…");
            return Promise.all(files.map(uploadAssetForGrapes))
              .then((urls) => {
                editorRef.current?.AssetManager.add(urls);
                toast.success("Image uploaded", { id: toastId });
              })
              .catch((err) => {
                toast.error("Failed to upload image", { id: toastId });
                throw err;
              });
          },
        },
        plugins: [presetNewsletter],
        ...(initialProjectData ? { projectData: initialProjectData } : { components: initialHtml }),
      });
      editorRef.current = editor;

      editor.RichTextEditor.add("mergeTag", {
        icon: `<select class="gjs-field" style="max-width:110px;">
          <option value="">Insert tag…</option>
          ${MERGE_TAGS.map((t) => `<option value="${t.tag}">${t.label}</option>`).join("")}
        </select>`,
        event: "change",
        result: (rte, action) => {
          const select = action.btn?.querySelector("select") as HTMLSelectElement | null;
          const tag = select?.value;
          if (tag) rte.insertHTML(`{{${tag}}}`);
          if (select) select.value = "";
        },
      });

      editor.RichTextEditor.add("trackedLink", {
        icon: `<span style="font-size:12px;padding:0 2px;" title="Insert tracked link">🔗+</span>`,
        event: "click",
        result: (rte) => {
          const url = window.prompt("Destination URL (where the click should land):");
          if (!url?.trim()) return;
          let normalized: string;
          try {
            normalized = normalizeUrl(url);
          } catch {
            window.alert("That doesn't look like a valid URL — include https://");
            return;
          }
          const label = window.prompt("Label for this link (optional, shown in click stats):") || "";
          const trackedHref = buildTrackedLinkHref(templateId, normalized, label);
          rte.insertHTML(`<a href="${trackedHref}">${label.trim() || normalized}</a>`);
        },
      });

      editor.on("update", () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          onChangeRef.current(editor.getHtml(), editor.getCss() || "", editor.getProjectData());
        }, 500);
      });

      // `init()` returns before the canvas iframe has actually finished loading — calling
      // getHtml() synchronously here can race ahead of that and return empty/partial content.
      // Wait for GrapesJS's own "load" event instead of firing immediately.
      editor.on("load", () => {
        onChangeRef.current(editor.getHtml(), editor.getCss() || "", editor.getProjectData());
      });
    })();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      editorRef.current?.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
});

export default GrapesEditor;
