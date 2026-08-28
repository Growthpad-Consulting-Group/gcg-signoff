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
      return { id, type, src: "", alt: "", width: 120, align: "left" };
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
