"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MediaPicker from "@/shared/ui/MediaPicker";
import RichTextEditor from "@/features/signatures/ui/RichTextEditor";
import {
  Align,
  Block,
  ColumnPath,
  ColumnStyle,
  cloneBlockWithNewIds,
  createBlock,
  findBlockById,
  findContainerPath,
  getListAt,
  insertAfterId,
  insertIntoList,
  removeBlockById,
  removeBlockWithResult,
  sameColumnPath,
  updateBlockById,
  updateColumnList,
  wrapLegacyHtml,
} from "@/features/signatures/lib/blocks";
import { serializeBlocks } from "@/features/signatures/lib/blockSerializer";

// dnd-kit droppable ids for each list's *container* (distinct from any block's own id) — needed
// so an empty column, which otherwise has nothing to be "over", is still a valid drop target,
// and so onDragEnd can tell which list a drop landed in when it wasn't dropped on an item.
const ROOT_CONTAINER_ID = "container:root";
const columnContainerId = (columnsId: string, colIndex: number) => `container:${columnsId}:${colIndex}`;
function parseContainerId(id: string): ColumnPath | null | undefined {
  if (id === ROOT_CONTAINER_ID) return null;
  const m = /^container:(.+):(\d+)$/.exec(id);
  return m ? { columnsId: m[1], colIndex: Number(m[2]) } : undefined;
}

// Draggable id for a palette entry — distinguishes "dragging a new block in from the palette"
// from "reordering/moving an existing block" in onDragEnd, since both share one DndContext.
const PALETTE_DRAG_PREFIX = "palette:";
const paletteDragId = (type: Block["type"]) => `${PALETTE_DRAG_PREFIX}${type}`;
const paletteTypeFromDragId = (id: string): Block["type"] | null => (id.startsWith(PALETTE_DRAG_PREFIX) ? (id.slice(PALETTE_DRAG_PREFIX.length) as Block["type"]) : null);

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
  { type: "columns", label: "Columns", icon: "solar:widget-4-broken" },
];

// Columns-within-columns isn't supported (one level of nesting is enough for the "slice a banner
// into side-by-side clickable pieces" use case this exists for), so the mini palette shown
// inside a column omits it.
const MINI_PALETTE = PALETTE.filter((p) => p.type !== "columns");

const SOCIAL_OPTIONS = ["linkedin", "instagram", "facebook", "x", "youtube"];

interface ListActions {
  selectedId: string | null;
  templateId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTextChange: (id: string, html: string) => void;
  onInsertBlockAfter: (id: string, type: Block["type"]) => void;
  onReorder: (path: ColumnPath | null, oldIndex: number, newIndex: number) => void;
  onAddBlock: (path: ColumnPath | null, type: Block["type"]) => void;
}

function BlockPreview({ block, editingText, actions }: { block: Block; editingText?: boolean; actions: ListActions }) {
  switch (block.type) {
    case "text":
      // Only the selected text block mounts a live Tiptap instance — mounting one per block up
      // front would be wasteful, and only one can be focused/edited at a time anyway.
      return editingText ? (
        <RichTextEditor
          html={block.html}
          onChange={(html) => actions.onTextChange(block.id, html)}
          templateId={actions.templateId}
          onInsertBlockAfter={(type) => actions.onInsertBlockAfter(block.id, type)}
        />
      ) : (
        <div className="text-sm text-text-hi" dangerouslySetInnerHTML={{ __html: block.html }} />
      );
    case "image":
      return block.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src}
          alt={block.alt}
          style={{ width: block.width, height: block.height, objectFit: block.height ? "cover" : undefined, maxWidth: "100%" }}
          className={block.align === "center" ? "mx-auto" : block.align === "right" ? "ml-auto" : ""}
        />
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
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}>
          {block.columns.map((col, idx) => {
            const cs = block.columnStyles[idx] || {};
            const borderColor = cs.borderColor || "#e5e7eb";
            const realStyle: React.CSSProperties = {
              padding: cs.padding,
              backgroundColor: cs.backgroundColor,
              borderTop: cs.borderTop ? `2px solid ${borderColor}` : undefined,
              borderRight: cs.borderRight ? `2px solid ${borderColor}` : undefined,
              borderBottom: cs.borderBottom ? `2px solid ${borderColor}` : undefined,
              borderLeft: cs.borderLeft ? `2px solid ${borderColor}` : undefined,
            };
            return (
              // The outer dashed box is just an editing affordance; `realStyle` on the inner div
              // is what actually ships in the exported HTML (see blockSerializer.ts).
              <div key={idx} onClick={(e) => e.stopPropagation()} className="rounded-lg border border-dashed border-app-border/50 p-1">
                <div style={realStyle}>
                  <BlockList blocks={col} path={{ columnsId: block.id, colIndex: idx }} actions={actions} nested />
                </div>
              </div>
            );
          })}
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

function SortableBlock({ block, actions }: { block: Block; actions: ListActions }) {
  const selected = block.id === actions.selectedId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  // A live Tiptap instance is mounted while a text block is selected — dragging from anywhere on
  // its body would hijack click-and-drag text selection (needed for the bubble menu), so only
  // the handle drags in that case. Every other block (or a text block when not being edited)
  // drags from anywhere; PointerSensor's 8px activation distance already tells a genuine drag
  // apart from a plain click, so this doesn't fight the onClick-to-select below it.
  const wholeBodyDraggable = !(block.type === "text" && selected);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => actions.onSelect(block.id)}
      {...(wholeBodyDraggable ? attributes : {})}
      {...(wholeBodyDraggable ? listeners : {})}
      // Notion-style chrome: no permanent box, just a hover-revealed drag handle/delete and a
      // left accent bar on selection — a permanent bordered card per block is what reads as
      // "basic" as much as anything about the text editor itself.
      className={`group relative flex items-start gap-1 rounded-md py-1 pr-1 transition-colors ${wholeBodyDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
        selected ? "bg-brand-500/5" : "hover:bg-surface-2/60"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title="Drag to move"
        className="mt-1 shrink-0 cursor-grab text-text-lo opacity-0 transition-opacity hover:text-text-hi active:cursor-grabbing group-hover:opacity-100"
      >
        <Icon icon="solar:hamburger-menu-broken" className="h-4 w-4" />
      </button>
      <div className={`min-w-0 flex-1 border-l-2 pl-3 ${selected ? "border-brand-500" : "border-transparent"}`}>
        <BlockPreview block={block} editingText={selected} actions={actions} />
      </div>
      <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.onDuplicate(block.id);
          }}
          title="Duplicate"
          className="text-text-lo hover:text-text-hi"
        >
          <Icon icon="solar:copy-broken" className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.onRemove(block.id);
          }}
          title="Delete"
          className="text-text-lo hover:text-status-danger"
        >
          <Icon icon="solar:trash-bin-trash-broken" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Renders one block list — either the top-level canvas (`path: null`) or one column of a
 * `columns` block (`path` set). Recurses via BlockPreview's "columns" case, so nesting is just "a
 * BlockList inside a BlockList". Drag-and-drop is *not* scoped here — one `DndContext` at the
 * `BlockEditor` root spans every list (this is dnd-kit's standard multi-container pattern), so a
 * block can be dragged between lists, not just reordered within one. `useDroppable` on the
 * container itself (rather than relying only on item-level sortable ids) is what makes an empty
 * column — which otherwise has no item to be "over" — still a valid drop target. */
function BlockList({ blocks, path, actions, nested }: { blocks: Block[]; path: ColumnPath | null; actions: ListActions; nested?: boolean }) {
  const containerId = path ? columnContainerId(path.columnsId, path.colIndex) : ROOT_CONTAINER_ID;
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div ref={setNodeRef} className={`rounded-lg transition-colors ${isOver ? "bg-brand-500/5" : ""}`}>
      {blocks.length === 0 ? (
        <p className={nested ? "py-3 text-center text-xs text-text-lo" : "py-12 text-center text-sm text-text-lo"}>
          {nested ? "Empty column" : "Add a block from the panel to get started."}
        </p>
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {blocks.map((block) => (
              <SortableBlock key={block.id} block={block} actions={actions} />
            ))}
          </div>
        </SortableContext>
      )}
      {nested && (
        <div className="mt-1 flex flex-wrap gap-0.5 border-t border-app-border pt-1">
          {MINI_PALETTE.map((p) => (
            <button
              key={p.type}
              title={`Add ${p.label}`}
              onClick={() => actions.onAddBlock(path, p.type)}
              className="rounded p-1 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
            >
              <Icon icon={p.icon} className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One entry in the main sidebar palette — click still appends to the end of the canvas
 * (unchanged), but it's now also a drag source: pick it up and drop it anywhere in the canvas or
 * directly into a column to insert it right there, via the same onDragEnd the block-move/reorder
 * logic uses (distinguished by the `palette:` id prefix). */
function PaletteButton({ type, label, icon, onClick }: { type: Block["type"]; label: string; icon: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: paletteDragId(type) });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi transition-colors hover:bg-surface-2 ${
        isDragging ? "cursor-grabbing opacity-50" : "cursor-grab"
      }`}
    >
      <Icon icon={icon} className="h-4 w-4 text-brand-600" />
      {label}
    </button>
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
  // Label shown in the DragOverlay while dragging a *new* block in from the palette — sortable
  // items already get their own transform-based preview from useSortable, so this only needs to
  // cover the palette case (which isn't part of any SortableContext).
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Undo/redo over the whole block tree. Snapshots are coalesced on a pause in editing (not
  // pushed per keystroke — that'd make undo require one press per character typed) using the
  // same debounce-on-settle pattern as the autosave notification below, just with its own timer.
  const historyRef = useRef<Block[][]>([]);
  const futureRef = useRef<Block[][]>([]);
  const lastSnapshotRef = useRef<Block[]>(blocks);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0); // bumped to re-render Undo/Redo's disabled state

  const undo = () => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, blocks];
    lastSnapshotRef.current = previous;
    setBlocks(previous);
    setSelectedId(null);
    setHistoryVersion((v) => v + 1);
  };

  const redo = () => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, blocks];
    lastSnapshotRef.current = next;
    setBlocks(next);
    setSelectedId(null);
    setHistoryVersion((v) => v + 1);
  };

  // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z — but not while focus is inside a text block's Tiptap editor,
  // which has its own character-level undo (StarterKit's History extension); letting both fire
  // on the same keypress would double-undo.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key.toLowerCase() !== "z") return;
      if (e.target instanceof HTMLElement && e.target.closest(".ProseMirror")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const selected = selectedId ? findBlockById(blocks, selectedId) : null;

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

  // Commits `lastSnapshotRef` (the state from before this burst of edits) onto the undo stack
  // once edits settle, then moves the snapshot forward — one undo step per pause in editing.
  useEffect(() => {
    if (!mountedRef.current) return; // the mount-time effect above already set lastSnapshotRef
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      if (lastSnapshotRef.current !== blocks) {
        historyRef.current = [...historyRef.current.slice(-49), lastSnapshotRef.current];
        futureRef.current = [];
        lastSnapshotRef.current = blocks;
        setHistoryVersion((v) => v + 1);
      }
    }, 600);
    return () => {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => updateBlockById(prev, id, patch));
  };

  const addBlock = (type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => removeBlockById(prev, id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const block = findBlockById(blocks, id);
    if (!block) return;
    const clone = cloneBlockWithNewIds(block);
    setBlocks((prev) => {
      const { result, inserted } = insertAfterId(prev, id, clone);
      return inserted ? result : [...prev, clone];
    });
    setSelectedId(clone.id);
  };

  // Splices a new block right after `afterId`, wherever it is in the tree — used by the "/"
  // slash-command menu inside a text block, so a block can be added without leaving the writing
  // flow for the side palette (or the mini palette, if the text block is inside a column).
  const insertBlockAfter = (afterId: string, type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => {
      const { result, inserted } = insertAfterId(prev, afterId, block);
      return inserted ? result : [...prev, block];
    });
    setSelectedId(block.id);
  };

  // Adds to the top-level canvas (path null) or a specific column (path set) — the mini palette
  // under each column uses this to let a column be filled without dragging from the main panel.
  const addBlockToList = (path: ColumnPath | null, type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => (path ? updateColumnList(prev, path, (col) => [...col, block]) : [...prev, block]));
    setSelectedId(block.id);
  };

  const reorderList = (path: ColumnPath | null, oldIndex: number, newIndex: number) => {
    setBlocks((prev) => (path ? updateColumnList(prev, path, (col) => arrayMove(col, oldIndex, newIndex)) : arrayMove(prev, oldIndex, newIndex)));
  };

  const actions: ListActions = {
    selectedId,
    templateId,
    onSelect: setSelectedId,
    onRemove: removeBlock,
    onDuplicate: duplicateBlock,
    onTextChange: (id, html) => updateBlock(id, { html }),
    onInsertBlockAfter: insertBlockAfter,
    onReorder: reorderList,
    onAddBlock: addBlockToList,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const paletteType = paletteTypeFromDragId(String(event.active.id));
    setActiveDragLabel(paletteType ? PALETTE.find((p) => p.type === paletteType)?.label ?? null : null);
  };

  // Single DndContext for the whole tree (top-level canvas + every column) — dnd-kit's standard
  // multi-container pattern, which is what lets a block move between lists instead of only
  // reordering within the one it started in.
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLabel(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Dragging a new block in from the palette, rather than moving/reordering an existing one.
    const paletteType = paletteTypeFromDragId(activeId);
    if (paletteType) {
      const parsedContainer = parseContainerId(overId);
      const overIsContainer = parsedContainer !== undefined;
      const toPath = overIsContainer ? parsedContainer : findContainerPath(blocks, overId);
      if (toPath === undefined) return;
      const newBlock = createBlock(paletteType);
      setBlocks((prev) => {
        const targetList = getListAt(prev, toPath);
        const targetIndex = overIsContainer ? targetList.length : targetList.findIndex((b) => b.id === overId);
        return insertIntoList(prev, toPath, newBlock, targetIndex === -1 ? targetList.length : targetIndex);
      });
      setSelectedId(newBlock.id);
      return;
    }

    if (activeId === overId) return;

    const fromPath = findContainerPath(blocks, activeId);
    if (fromPath === undefined) return;

    const parsedContainer = parseContainerId(overId);
    const overIsContainer = parsedContainer !== undefined;
    const toPath = overIsContainer ? parsedContainer : findContainerPath(blocks, overId);
    if (toPath === undefined) return;

    if (sameColumnPath(fromPath, toPath)) {
      if (overIsContainer) return; // dropped on empty space in its own list — nothing to reorder against
      const list = getListAt(blocks, fromPath);
      const oldIndex = list.findIndex((b) => b.id === activeId);
      const newIndex = list.findIndex((b) => b.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      reorderList(fromPath, oldIndex, newIndex);
      return;
    }

    // Moving to a different list entirely — remove from the source, insert into the target.
    setBlocks((prev) => {
      const { result, removed } = removeBlockWithResult(prev, activeId);
      if (!removed) return prev;
      const targetList = getListAt(result, toPath);
      const targetIndex = overIsContainer ? targetList.length : targetList.findIndex((b) => b.id === overId);
      return insertIntoList(result, toPath, removed, targetIndex === -1 ? targetList.length : targetIndex);
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="flex h-full min-h-0">
      {/* Palette */}
      <div className="w-56 shrink-0 overflow-y-auto border-r border-app-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Add block</p>
        <p className="mb-2 text-xs text-text-lo">Click to add, or drag onto the canvas — even directly into a column.</p>
        <div className="space-y-2">
          {PALETTE.map((p) => (
            <PaletteButton key={p.type} type={p.type} label={p.label} icon={p.icon} onClick={() => addBlock(p.type)} />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto bg-surface-2/40 p-10">
        <div className="mx-auto w-full max-w-[600px]">
          <div className="mb-2 flex items-center justify-end gap-1" data-history-version={historyVersion}>
            <button
              onClick={undo}
              disabled={historyRef.current.length === 0}
              title="Undo (Ctrl/Cmd+Z)"
              className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon icon="solar:undo-left-broken" className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={futureRef.current.length === 0}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon icon="solar:undo-right-broken" className="h-4 w-4" />
            </button>
          </div>
          <div className="rounded-lg bg-surface p-6 shadow-sm">
            <BlockList blocks={blocks} path={null} actions={actions} />
          </div>
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
                <Field label="Height (px)">
                  <input
                    type="number"
                    value={selected.height ?? ""}
                    onChange={(e) => updateBlock(selected.id, { height: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Auto"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-text-lo">
                    Leave blank to preserve the image's own aspect ratio. A set height crops to fill (not supported in Outlook desktop — it stretches instead).
                  </p>
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

            {selected.type === "columns" && (
              <>
                <Field label="Number of columns">
                  <select
                    value={selected.columns.length}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const columns = Array.from({ length: n }, (_, i) => selected.columns[i] || []);
                      const columnStyles = Array.from({ length: n }, (_, i) => selected.columnStyles[i] || {});
                      updateBlock(selected.id, { columns, columnStyles });
                    }}
                    className={inputClass}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </Field>

                {selected.columns.map((_, idx) => {
                  const cs = selected.columnStyles[idx] || {};
                  const updateColumnStyle = (patch: Partial<ColumnStyle>) => {
                    const columnStyles = selected.columnStyles.map((s, i) => (i === idx ? { ...s, ...patch } : s));
                    updateBlock(selected.id, { columnStyles });
                  };
                  return (
                    <div key={idx} className="space-y-2 rounded-lg border border-app-border p-2.5">
                      <p className="text-xs font-medium text-text-hi">Column {idx + 1}</p>
                      <div className="flex flex-wrap gap-3">
                        {(["borderTop", "borderRight", "borderBottom", "borderLeft"] as const).map((side) => (
                          <label key={side} className="flex items-center gap-1 text-xs text-text-lo">
                            <input type="checkbox" checked={!!cs[side]} onChange={(e) => updateColumnStyle({ [side]: e.target.checked })} />
                            {side.replace("border", "")}
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Border color">
                          <input type="color" value={cs.borderColor || "#e5e7eb"} onChange={(e) => updateColumnStyle({ borderColor: e.target.value })} className="h-8 w-full rounded-lg border border-app-border" />
                        </Field>
                        <Field label="Background">
                          <input type="color" value={cs.backgroundColor || "#ffffff"} onChange={(e) => updateColumnStyle({ backgroundColor: e.target.value })} className="h-8 w-full rounded-lg border border-app-border" />
                        </Field>
                      </div>
                      <Field label="Padding (px)">
                        <input type="number" value={cs.padding || 0} onChange={(e) => updateColumnStyle({ padding: Number(e.target.value) || 0 })} className={inputClass} />
                      </Field>
                    </div>
                  );
                })}
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

      <DragOverlay>
        {activeDragLabel && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-500 bg-surface px-3 py-2 text-sm font-medium text-text-hi shadow-lg">
            <Icon icon="solar:add-circle-broken" className="h-4 w-4 text-brand-600" />
            {activeDragLabel}
          </div>
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
});

export default BlockEditor;
