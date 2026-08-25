"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import { MERGE_TAGS } from "@/features/signatures/lib/mergeTags";

export interface GrapesEditorHandle {
  getExport: () => { html: string; css: string; projectData: unknown };
}

interface GrapesEditorProps {
  initialHtml: string;
  initialProjectData?: unknown;
  onChange: (html: string, css: string, projectData: unknown) => void;
}

const GrapesEditor = forwardRef<GrapesEditorHandle, GrapesEditorProps>(function GrapesEditor(
  { initialHtml, initialProjectData, onChange },
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

      editor.on("update", () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          onChangeRef.current(editor.getHtml(), editor.getCss() || "", editor.getProjectData());
        }, 500);
      });

      // Fire once immediately so the live preview reflects the initial content right away.
      onChangeRef.current(editor.getHtml(), editor.getCss() || "", editor.getProjectData());
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
