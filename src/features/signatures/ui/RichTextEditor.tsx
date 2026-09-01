"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Paragraph } from "@tiptap/extension-paragraph";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Editor, Extension, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { Icon } from "@iconify/react";
import { MERGE_TAGS } from "@/features/signatures/lib/mergeTags";
import { buildTrackedLinkHref, normalizeUrl } from "@/features/signatures/lib/trackedLink";
import { Block } from "@/features/signatures/lib/blocks";
import SlashCommandMenu, { SlashCommandMenuHandle, SlashItem } from "@/features/signatures/ui/SlashCommandMenu";
import SimpleModal from "@/shared/ui/SimpleModal";

const BLOCK_ICONS: Record<string, string> = {
  image: "solar:gallery-broken",
  button: "solar:cursor-broken",
  divider: "solar:minus-square-broken",
  spacer: "solar:maximize-square-broken",
  social: "solar:share-broken",
  columns: "solar:layout-2-broken",
};
const BLOCK_LABELS: Record<string, string> = {
  image: "Image block",
  button: "Button block",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social row",
  columns: "Columns",
};

// Tiptap's stock Paragraph node has no `style` attribute in its schema, so parsing a paragraph
// that came with one (e.g. a preset block's `<p style="margin:0;...">`) silently drops it — the
// moment a text block is selected and its Tiptap instance mounts, any custom paragraph styling
// vanishes, and the next real edit saves that stripped version permanently. This extension round-
// trips `style` like any other attribute so a preset's inline styling survives being edited.
const StyledParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
});

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

function MergeTagButton({ onInsert }: { onInsert: (tag: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Insert merge tag"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={`rounded p-1.5 transition-colors ${open ? "bg-brand-500 text-white" : "text-text-lo hover:bg-surface-2 hover:text-text-hi"}`}
      >
        <Icon icon="solar:hashtag-broken" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-app-border bg-surface py-1 shadow-lg">
          {MERGE_TAGS.map((t) => (
            <button
              key={t.tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onInsert(t.tag); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-2"
            >
              <span className="text-text-lo">{t.label}</span>
              <span className="font-mono text-brand-600">{`{{${t.tag}}}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({
  html,
  onChange,
  templateId,
  onInsertBlockAfter,
}: {
  html: string;
  onChange: (html: string) => void;
  templateId: string;
  onInsertBlockAfter?: (type: Block["type"]) => void;
}) {
  // Replaces the old window.prompt()-based flow with a real modal — "linkRange" doubles as both
  // the open/closed flag and the pending insertion point: "none" for the toolbar/bubble-menu case
  // (insert at the current selection), a {from,to} range for the slash-command case (replace the
  // "/link" text itself), null when the modal is closed.
  const [linkRange, setLinkRange] = useState<{ from: number; to: number } | "none" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState("");

  const openLinkModal = (range?: { from: number; to: number }) => {
    setLinkRange(range ?? "none");
    setLinkUrl("");
    // Default the Label field to whatever text is currently selected (the toolbar/bubble-menu
    // case only — a slash-command `range` is the "/link" trigger text itself, not real content).
    // Leaving Label blank used to silently replace the selection with the raw URL instead of
    // keeping what was selected, which isn't how "add a link" behaves anywhere else — selecting
    // "+254 701 850 850" and linking it should keep showing "+254 701 850 850", not the URL.
    const selectedText =
      !range && editor && !editor.state.selection.empty
        ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")
        : "";
    setLinkLabel(selectedText);
    setLinkError("");
  };

  const confirmLinkModal = (editor: ReturnType<typeof useEditor>) => {
    if (!editor) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkError("Enter a destination URL.");
      return;
    }
    let normalized: string;
    try {
      normalized = normalizeUrl(trimmed);
    } catch {
      setLinkError("That doesn't look like a valid URL — include https://");
      return;
    }
    const trackedHref = buildTrackedLinkHref(templateId, normalized, linkLabel);
    const text = linkLabel.trim() || normalized;
    const chain = editor.chain().focus();
    if (linkRange && linkRange !== "none") chain.deleteRange(linkRange);
    chain.insertContent(`<a href="${trackedHref}">${text}</a>`).run();
    setLinkRange(null);
  };

  // "/" opens a filterable menu — insert a new block (image/button/divider/…), a merge tag, or
  // a tracked link, right from the writing flow instead of a separate always-visible toolbar.
  const SlashCommand = useMemo(
    () =>
      Extension.create({
        name: "slashCommand",
        addProseMirrorPlugins() {
          let component: ReactRenderer<SlashCommandMenuHandle> | null = null;
          let unmount: (() => void) | null = null;

          const allItems: SlashItem[] = [
            ...(onInsertBlockAfter
              ? (Object.keys(BLOCK_LABELS) as Block["type"][]).map(
                  (type): SlashItem => ({
                    id: `block-${type}`,
                    label: BLOCK_LABELS[type],
                    icon: BLOCK_ICONS[type],
                    action: (editor: Editor, range: Range) => {
                      editor.chain().focus().deleteRange(range).run();
                      onInsertBlockAfter(type);
                    },
                  })
                )
              : []),
            ...MERGE_TAGS.map(
              (t): SlashItem => ({
                id: `tag-${t.tag}`,
                label: `Merge tag: ${t.label}`,
                icon: "solar:hashtag-broken",
                action: (editor: Editor, range: Range) => {
                  editor.chain().focus().deleteRange(range).insertContent(`{{${t.tag}}}`).run();
                },
              })
            ),
            {
              id: "tracked-link",
              label: "Tracked link",
              icon: "solar:link-broken",
              action: (_editor: Editor, range: Range) => {
                openLinkModal(range);
              },
            },
          ];

          return [
            Suggestion({
              editor: this.editor,
              char: "/",
              allowedPrefixes: null,
              items: ({ query }: { query: string }) => allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
              command: ({ editor, range, props }: { editor: any; range: any; props: SlashItem }) => {
                props.action(editor, range);
              },
              render: () => ({
                onStart: (props: any) => {
                  component = new ReactRenderer(SlashCommandMenu, { props, editor: props.editor });
                  unmount = props.mount(component.element);
                },
                onUpdate: (props: any) => {
                  component?.updateProps(props);
                },
                onKeyDown: (props: { event: KeyboardEvent }) => {
                  if (props.event.key === "Escape") {
                    unmount?.();
                    return true;
                  }
                  return component?.ref?.onKeyDown(props.event) ?? false;
                },
                onExit: () => {
                  unmount?.();
                  component?.destroy();
                },
              }),
            }),
          ];
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templateId, onInsertBlockAfter]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, paragraph: false }), // email signatures have no use for h1-h6 sizing; StyledParagraph below replaces the default
      StyledParagraph,
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
      TextAlign.configure({ types: ["paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: "Type '/' for commands, or just start writing…" }),
      SlashCommand,
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

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Persistent toolbar — always visible so merge tags and links are reachable on empty blocks */}
      <div className="mb-1 flex items-center gap-0.5 rounded-lg border border-app-border bg-surface p-1">
        <MergeTagButton onInsert={(tag) => editor.chain().focus().insertContent(`{{${tag}}}`).run()} />
        <ToolbarButton title="Tracked link" icon="solar:link-broken" onClick={() => openLinkModal()} />
      </div>
      <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-lg border border-app-border bg-surface p-1 shadow-lg">
        <ToolbarButton title="Bold" icon="solar:text-bold-broken" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton title="Italic" icon="solar:text-italic-broken" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton title="Underline" icon="solar:text-underline-broken" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <div className="mx-0.5 h-4 w-px bg-app-border" />
        <ToolbarButton title="Align left" icon="solar:align-left-broken" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
        <ToolbarButton title="Align center" icon="solar:align-horizontal-center-broken" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
        <ToolbarButton title="Align right" icon="solar:align-right-broken" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
        <div className="mx-0.5 h-4 w-px bg-app-border" />
        <ToolbarButton title="Highlight" icon="solar:pen-broken" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight({ color: "#fff1c2" }).run()} />
        <ToolbarButton title="Brand color text" icon="solar:palette-broken" active={editor.isActive("textStyle", { color: "#f05d23" })} onClick={() => editor.chain().focus().setColor("#f05d23").run()} />
        <ToolbarButton title="Link" icon="solar:link-broken" onClick={() => openLinkModal()} />
        <div className="mx-0.5 h-4 w-px bg-app-border" />
        <MergeTagButton onInsert={(tag) => editor.chain().focus().insertContent(`{{${tag}}}`).run()} />
      </BubbleMenu>
      <EditorContent editor={editor} />

      <SimpleModal isOpen={linkRange !== null} onClose={() => setLinkRange(null)} title="Insert tracked link" width="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-hi">Destination URL</label>
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmLinkModal(editor)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-hi">Label (optional)</label>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmLinkModal(editor)}
              placeholder="Link text, and how it's named in click stats — defaults to your selection"
              className="w-full rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {linkError && <p className="text-xs text-status-danger">{linkError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setLinkRange(null)}
              className="rounded-lg border border-app-border bg-surface px-3 py-1.5 text-sm font-medium text-text-hi hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmLinkModal(editor)}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Insert link
            </button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
