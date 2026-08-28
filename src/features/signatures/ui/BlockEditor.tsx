"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MediaPicker from "@/shared/ui/MediaPicker";
import RichTextEditor from "@/features/signatures/ui/RichTextEditor";
import { Align, Block, createBlock, wrapLegacyHtml } from "@/features/signatures/lib/blocks";
import { serializeBlocks } from "@/features/signatures/lib/blockSerializer";

export interface BlockEditorHandle {
  getExport: () => { blocks: Block[]; html: string };
}

interface BlockEditorProps {
  templateId: string;
  initialBlocks: Block[] | null;
  initialHtml: string;
  onChange: (blocks: Block[], html: string) => void;
}

const PALETTE: { type: Block["type"]; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "solar:text-broken" },
  { type: "image", label: "Image", icon: "solar:gallery-broken" },
  { type: "button", label: "Button", icon: "solar:cursor-broken" },
  { type: "divider", label: "Divider", icon: "solar:minus-square-broken" },
  { type: "spacer", label: "Spacer", icon: "solar:maximize-square-broken" },
  { type: "social", label: "Social row", icon: "solar:share-broken" },
  { type: "columns", label: "Columns", icon: "solar:layout-2-broken" },
];

const SOCIAL_OPTIONS = ["linkedin", "instagram", "facebook", "x", "youtube"];

function BlockPreview({
  block,
  editingText,
  templateId,
  onTextChange,
}: {
  block: Block;
  editingText?: boolean;
  templateId?: string;
  onTextChange?: (html: string) => void;
}) {
  switch (block.type) {
    case "text":
      // Only the selected text block mounts a live Tiptap instance — mounting one per block up
      // front would be wasteful, and only one can be focused/edited at a time anyway.
      return editingText && templateId && onTextChange ? (
        <RichTextEditor html={block.html} onChange={onTextChange} templateId={templateId} />
      ) : (
        <div className="text-sm text-text-hi" dangerouslySetInnerHTML={{ __html: block.html }} />
      );
    case "image":
      return block.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.src} alt={block.alt} style={{ width: block.width, maxWidth: "100%" }} className={block.align === "center" ? "mx-auto" : block.align === "right" ? "ml-auto" : ""} />
      ) : (
        <div className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-app-border text-text-lo">
          <Icon icon="solar:gallery-broken" className="h-5 w-5" />
        </div>
      );
    case "button":
      return (
        <div className={block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : ""}>
          <span className="inline-block rounded-md px-4 py-2 text-sm font-bold" style={{ backgroundColor: block.bgColor, color: block.textColor }}>
            {block.label}
          </span>
        </div>
      );
    case "divider":
      return <div className="border-t" style={{ borderColor: block.color }} />;
    case "spacer":
      return <div style={{ height: block.height }} className="text-xs text-text-lo/50">{`Spacer (${block.height}px)`}</div>;
    case "social":
      return (
        <div className={`flex gap-2 ${block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : ""}`}>
          {block.icons.length === 0 ? (
            <span className="text-xs text-text-lo">No icons added yet</span>
          ) : (
            block.icons.map((i, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={`/assets/icons/social/${i.icon}.png`} alt={i.icon} className="h-5 w-5" />
            ))
          )}
        </div>
      );
    case "columns":
      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}>
          {block.columns.map((col, idx) => (
            <div key={idx} className="rounded border border-dashed border-app-border p-2 text-xs text-text-lo">
              {col.length === 0 ? "Empty column" : `${col.length} block${col.length === 1 ? "" : "s"}`}
            </div>
          ))}
        </div>
      );
    case "html":
      return (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
          <p className="mb-1 flex items-center gap-1 font-medium">
            <Icon icon="solar:code-broken" className="h-3.5 w-3.5" />
            Advanced HTML block
          </p>
          <p>Raw HTML from before the visual editor — edit it in the Settings panel, or replace it with real blocks.</p>
        </div>
      );
  }
}

function SortableBlock({
  block,
  selected,
  templateId,
  onSelect,
  onRemove,
  onTextChange,
}: {
  block: Block;
  selected: boolean;
  templateId: string;
  onSelect: () => void;
  onRemove: () => void;
  onTextChange: (html: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      // Notion-style chrome: no permanent box, just a hover-revealed drag handle/delete and a
      // left accent bar on selection — a permanent bordered card per block is what reads as
      // "basic" as much as anything about the text editor itself.
      className={`group relative flex cursor-pointer items-start gap-1 rounded-md py-1 pr-1 transition-colors ${
        selected ? "bg-brand-500/5" : "hover:bg-surface-2/60"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 shrink-0 cursor-grab text-text-lo opacity-0 transition-opacity hover:text-text-hi active:cursor-grabbing group-hover:opacity-100"
      >
        <Icon icon="solar:hamburger-menu-broken" className="h-4 w-4" />
      </button>
      <div className={`min-w-0 flex-1 border-l-2 pl-3 ${selected ? "border-brand-500" : "border-transparent"}`}>
        <BlockPreview block={block} editingText={selected} templateId={templateId} onTextChange={onTextChange} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="mt-1 shrink-0 text-text-lo opacity-0 transition-opacity hover:text-status-danger group-hover:opacity-100"
      >
        <Icon icon="solar:trash-bin-trash-broken" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-hi">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500";

const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
  { templateId, initialBlocks, initialHtml, onChange },
  ref
) {
  const [blocks, setBlocks] = useState<Block[]>(() => (initialBlocks && initialBlocks.length > 0 ? initialBlocks : wrapLegacyHtml(initialHtml)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const selected = blocks.find((b) => b.id === selectedId) || null;

  useImperativeHandle(ref, () => ({
    getExport: () => ({ blocks, html: serializeBlocks(blocks, templateId) }),
  }));

  // Fires once immediately on mount (so the page's preview/autosave state reflects the initial
  // content right away, matching GrapesEditor's "load" event) and debounced on every edit after.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onChangeRef.current(blocks, serializeBlocks(blocks, templateId));
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChangeRef.current(blocks, serializeBlocks(blocks, templateId));
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  };

  const addBlock = (type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Palette */}
      <div className="w-56 shrink-0 overflow-y-auto border-r border-app-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Add block</p>
        <div className="space-y-2">
          {PALETTE.map((p) => (
            <button
              key={p.type}
              onClick={() => addBlock(p.type)}
              className="flex w-full items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi transition-colors hover:bg-surface-2"
            >
              <Icon icon={p.icon} className="h-4 w-4 text-brand-600" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto bg-surface-2/40 p-10">
        <div className="mx-auto w-full max-w-[600px]">
          {blocks.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-lo">Add a block from the panel to get started.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1 rounded-lg bg-surface p-6 shadow-sm">
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      selected={block.id === selectedId}
                      templateId={templateId}
                      onSelect={() => setSelectedId(block.id)}
                      onRemove={() => removeBlock(block.id)}
                      onTextChange={(html) => updateBlock(block.id, { html })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="w-80 shrink-0 overflow-y-auto border-l border-app-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Settings</p>
        {!selected ? (
          <p className="text-sm text-text-lo">Select a block to edit its settings.</p>
        ) : (
          <div className="space-y-3">
            {selected.type === "text" && (
              <p className="text-sm text-text-lo">Edit the text directly in the canvas — use its toolbar for formatting, merge tags, and tracked links.</p>
            )}

            {selected.type === "image" && (
              <>
                <Field label="Image">
                  <div className="flex items-center gap-2">
                    {selected.src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.src} alt="" className="h-10 w-10 rounded border border-app-border object-cover" />
                    )}
                    <button onClick={() => setPickerOpenFor(selected.id)} className="rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi hover:bg-surface-2">
                      {selected.src ? "Change image" : "Choose image"}
                    </button>
                  </div>
                </Field>
                <Field label="Alt text">
                  <input value={selected.alt} onChange={(e) => updateBlock(selected.id, { alt: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Width (px)">
                  <input type="number" value={selected.width} onChange={(e) => updateBlock(selected.id, { width: Number(e.target.value) || 0 })} className={inputClass} />
                </Field>
                <Field label="Align">
                  <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value as Align })} className={inputClass}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <Field label="Link URL (tracked)">
                  <input
                    value={selected.linkUrl || ""}
                    onChange={(e) => updateBlock(selected.id, { linkUrl: e.target.value })}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </Field>
                <Field label="Click label (optional)">
                  <input value={selected.linkLabel || ""} onChange={(e) => updateBlock(selected.id, { linkLabel: e.target.value })} className={inputClass} />
                </Field>
              </>
            )}

            {selected.type === "button" && (
              <>
                <Field label="Label">
                  <input value={selected.label} onChange={(e) => updateBlock(selected.id, { label: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Link URL (tracked)">
                  <input value={selected.url} onChange={(e) => updateBlock(selected.id, { url: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Background color">
                  <input type="color" value={selected.bgColor} onChange={(e) => updateBlock(selected.id, { bgColor: e.target.value })} className="h-9 w-full rounded-lg border border-app-border" />
                </Field>
                <Field label="Text color">
                  <input type="color" value={selected.textColor} onChange={(e) => updateBlock(selected.id, { textColor: e.target.value })} className="h-9 w-full rounded-lg border border-app-border" />
                </Field>
                <Field label="Align">
                  <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value as Align })} className={inputClass}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
              </>
            )}

            {selected.type === "divider" && (
              <Field label="Color">
                <input type="color" value={selected.color} onChange={(e) => updateBlock(selected.id, { color: e.target.value })} className="h-9 w-full rounded-lg border border-app-border" />
              </Field>
            )}

            {selected.type === "spacer" && (
              <Field label="Height (px)">
                <input type="number" value={selected.height} onChange={(e) => updateBlock(selected.id, { height: Number(e.target.value) || 0 })} className={inputClass} />
              </Field>
            )}

            {selected.type === "social" && (
              <>
                <Field label="Icons">
                  <div className="space-y-2">
                    {selected.icons.map((icon, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select
                          value={icon.icon}
                          onChange={(e) => {
                            const icons = [...selected.icons];
                            icons[idx] = { ...icons[idx], icon: e.target.value };
                            updateBlock(selected.id, { icons });
                          }}
                          className={inputClass}
                        >
                          {SOCIAL_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                        <input
                          value={icon.href}
                          onChange={(e) => {
                            const icons = [...selected.icons];
                            icons[idx] = { ...icons[idx], href: e.target.value };
                            updateBlock(selected.id, { icons });
                          }}
                          placeholder="https://…"
                          className={inputClass}
                        />
                        <button
                          onClick={() => updateBlock(selected.id, { icons: selected.icons.filter((_, i) => i !== idx) })}
                          className="text-text-lo hover:text-status-danger"
                        >
                          <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updateBlock(selected.id, { icons: [...selected.icons, { icon: "linkedin", href: "#" }] })}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      + Add icon
                    </button>
                  </div>
                </Field>
                <Field label="Align">
                  <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value as Align })} className={inputClass}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
              </>
            )}

            {selected.type === "html" && (
              <Field label="Raw HTML">
                <textarea value={selected.html} onChange={(e) => updateBlock(selected.id, { html: e.target.value })} rows={12} className={`${inputClass} font-mono text-xs`} />
              </Field>
            )}

            <button onClick={() => setSelectedId(null)} className="text-xs text-text-lo hover:text-text-hi">
              Done
            </button>
          </div>
        )}
      </div>

      <MediaPicker
        isOpen={!!pickerOpenFor}
        onClose={() => setPickerOpenFor(null)}
        onSelect={(url) => {
          if (pickerOpenFor) updateBlock(pickerOpenFor, { src: url });
          setPickerOpenFor(null);
        }}
      />
    </div>
  );
});

export default BlockEditor;
