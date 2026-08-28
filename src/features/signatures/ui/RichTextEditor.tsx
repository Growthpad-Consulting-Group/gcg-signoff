"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Icon } from "@iconify/react";
import { MERGE_TAGS } from "@/features/signatures/lib/mergeTags";
import { buildTrackedLinkHref, normalizeUrl } from "@/features/signatures/lib/trackedLink";

function ToolbarButton({ active, onClick, icon, title }: { active?: boolean; onClick: () => void; icon: string; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection/focus while clicking a toolbar button
      onClick={onClick}
      className={`rounded p-1.5 transition-colors ${active ? "bg-brand-500 text-white" : "text-text-lo hover:bg-surface-2 hover:text-text-hi"}`}
    >
      <Icon icon={icon} className="h-3.5 w-3.5" />
    </button>
  );
}

export default function RichTextEditor({
  html,
  onChange,
  templateId,
}: {
  html: string;
  onChange: (html: string) => void;
  templateId: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }), // email signatures have no use for h1-h6 sizing
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
    ],
    content: html,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none text-text-hi focus:outline-none min-h-[1.5em]",
      },
    },
  });

  // Keep the editor in sync if `html` changes from outside (e.g. after a version restore).
  useEffect(() => {
    if (editor && html !== editor.getHTML()) editor.commands.setContent(html, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  if (!editor) return null;

  const insertTrackedLink = () => {
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
    const text = label.trim() || normalized;
    const { from } = editor.state.selection;
    editor
      .chain()
      .focus()
      .insertContent(`<a href="${trackedHref}">${text}</a>`)
      .setTextSelection(from)
      .run();
  };

  return (
    <div className="rounded-lg border border-app-border bg-surface" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-app-border p-1">
        <ToolbarButton title="Bold" icon="solar:text-bold-broken" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton title="Italic" icon="solar:text-italic-broken" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton title="Underline" icon="solar:text-underline-broken" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolbarButton title="Bullet list" icon="solar:list-broken" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <div className="mx-1 h-4 w-px bg-app-border" />
        <select
          value=""
          onChange={(e) => {
            const tag = e.target.value;
            if (tag) editor.chain().focus().insertContent(`{{${tag}}}`).run();
            e.target.value = "";
          }}
          className="gjs-field rounded border border-app-border bg-surface px-1.5 py-1 text-xs text-text-hi"
        >
          <option value="">Insert tag…</option>
          {MERGE_TAGS.map((t) => (
            <option key={t.tag} value={t.tag}>
              {t.label}
            </option>
          ))}
        </select>
        <ToolbarButton title="Insert tracked link" icon="solar:link-broken" onClick={insertTrackedLink} />
      </div>
      <div className="p-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
