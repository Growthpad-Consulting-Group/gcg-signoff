/**
 * The block-tree schema backing the custom drag-and-drop signature editor (replaces GrapesJS).
 * Stored in `signature_templates.blocks` (jsonb); `html` remains the rendered/sent source of
 * truth, regenerated from this tree via `serializeBlocks()` (see blockSerializer.ts).
 */

export type Align = "left" | "center" | "right";

export interface TextBlock {
  id: string;
  type: "text";
  html: string; // rich-text HTML, may contain {{merge_tags}}
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
  width: number; // px
  align: Align;
  linkUrl?: string;
  linkLabel?: string;
}

export interface ButtonBlock {
  id: string;
  type: "button";
  label: string;
  url: string;
  bgColor: string;
  textColor: string;
  align: Align;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  color: string;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number; // px
}

export interface SocialIcon {
  icon: string; // e.g. "linkedin" — matches public/assets/icons/social/<icon>.png
  href: string;
}

export interface SocialBlock {
  id: string;
  type: "social";
  icons: SocialIcon[];
  align: Align;
}

export interface ColumnsBlock {
  id: string;
  type: "columns";
  columns: Block[][];
}

/** Legacy/advanced-escape-hatch block — raw HTML passed through as-is. Every template that
 * predates this editor (or has no `blocks` yet) is represented as a single block of this type,
 * wrapping its existing `html` column, so nothing is lost or forced to convert. */
export interface HtmlBlock {
  id: string;
  type: "html";
  html: string;
}

export type Block = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | SocialBlock | ColumnsBlock | HtmlBlock;

export function newBlockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function createBlock(type: Block["type"]): Block {
  const id = newBlockId();
  switch (type) {
    case "text":
      return { id, type, html: "<p>New text block — click to edit.</p>" };
    case "image":
      return { id, type, src: "", alt: "", width: 300, align: "left" };
    case "button":
      return { id, type, label: "Click here", url: "https://", bgColor: "#f05d23", textColor: "#ffffff", align: "left" };
    case "divider":
      return { id, type, color: "#e5e7eb" };
    case "spacer":
      return { id, type, height: 16 };
    case "social":
      return { id, type, icons: [], align: "left" };
    case "columns":
      return { id, type, columns: [[], []] };
    case "html":
      return { id, type, html: "" };
  }
}

/** Wraps existing raw HTML as a single-block tree — the fallback for any template that has no
 * `blocks` yet (every template as of this editor's introduction). */
export function wrapLegacyHtml(html: string): Block[] {
  return [{ id: newBlockId(), type: "html", html }];
}

/** Identifies one column inside a specific `columns` block — the addressing scheme for
 * operations (add/reorder) that need to know *which* list they're acting on, since a `columns`
 * block can be nested arbitrarily deep alongside plain top-level blocks. */
export interface ColumnPath {
  columnsId: string;
  colIndex: number;
}

/** Depth-first search for a block by id, descending into any `columns` block's columns. */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "columns") {
      for (const col of b.columns) {
        const found = findBlockById(col, id);
        if (found) return found;
      }
    }
  }
  return null;
}

/** Patches a block by id, wherever it lives in the tree. */
export function updateBlockById(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch } as Block;
    if (b.type === "columns") return { ...b, columns: b.columns.map((col) => updateBlockById(col, id, patch)) };
    return b;
  });
}

/** Removes a block by id, wherever it lives in the tree. */
export function removeBlockById(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => (b.type === "columns" ? { ...b, columns: b.columns.map((col) => removeBlockById(col, id)) } : b));
}

/** Splices `newBlock` right after the block with id `afterId`, wherever it lives in the tree.
 * `inserted` tells the caller whether `afterId` was actually found (so it can fall back to
 * appending at the top level otherwise). */
export function insertAfterId(blocks: Block[], afterId: string, newBlock: Block): { result: Block[]; inserted: boolean } {
  let inserted = false;
  const result = blocks.flatMap((b): Block[] => {
    if (b.id === afterId) {
      inserted = true;
      return [b, newBlock];
    }
    if (b.type === "columns") {
      const columns = b.columns.map((col) => {
        const r = insertAfterId(col, afterId, newBlock);
        if (r.inserted) inserted = true;
        return r.result;
      });
      return [{ ...b, columns }];
    }
    return [b];
  });
  return { result, inserted };
}

/** Applies `fn` to the block list at `path` (one specific column of one specific `columns`
 * block), wherever that block lives in the tree — used for reordering within, or adding into, a
 * single column. */
export function updateColumnList(blocks: Block[], path: ColumnPath, fn: (col: Block[]) => Block[]): Block[] {
  return blocks.map((b) => {
    if (b.id === path.columnsId && b.type === "columns") {
      const columns = b.columns.map((col, i) => (i === path.colIndex ? fn(col) : col));
      return { ...b, columns };
    }
    if (b.type === "columns") return { ...b, columns: b.columns.map((col) => updateColumnList(col, path, fn)) };
    return b;
  });
}
