"use client";

import { useEffect, useMemo } from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
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
  onInsertBlockAfter,
}: {
  html: string;
  onChange: (html: string) => void;
  templateId: string;
  onInsertBlockAfter?: (type: Block["type"]) => void;
}) {
  const insertTrackedLinkAt = (editor: ReturnType<typeof useEditor>, range?: { from: number; to: number }) => {
    if (!editor) return;
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
    const chain = editor.chain().focus();
    if (range) chain.deleteRange(range);
    chain.insertContent(`<a href="${trackedHref}">${text}</a>`).run();
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
              action: (editor: Editor, range: Range) => {
                insertTrackedLinkAt(editor, range);
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
      StarterKit.configure({ heading: false }), // email signatures have no use for h1-h6 sizing
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
        <ToolbarButton title="Link" icon="solar:link-broken" onClick={() => insertTrackedLinkAt(editor)} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
