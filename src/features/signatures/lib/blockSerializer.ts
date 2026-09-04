import type { Block } from "./blocks";
import { computeColumnWidths, imageBorderRadius } from "./blocks";
import { buildTrackedLinkHref, normalizeUrl, PRODUCTION_APP_URL } from "./trackedLink";

// PRODUCTION_APP_URL, not NEXT_PUBLIC_APP_URL — this gets baked into stored template html the
// moment a social row is added, from whichever environment happened to be editing (see
// trackedLink.ts's comment on the same gotcha for tracked links).
const SOCIAL_ICON = (icon: string) => `${PRODUCTION_APP_URL}/assets/icons/social/${icon}.png`;

const ALIGN_TD = (align: "left" | "center" | "right") => (align === "left" ? "" : `text-align:${align};`);

/** Wraps `inner` in a tracked-click href, if `templateId` + `linkUrl` are both present and valid. Falls back to a plain (untracked) link, then to no link at all. */
function trackedOrPlainHref(templateId: string | undefined, linkUrl: string | undefined, linkLabel: string | undefined): string | null {
  if (!linkUrl?.trim()) return null;
  let normalized: string;
  try {
    normalized = normalizeUrl(linkUrl);
  } catch {
    return null;
  }
  return templateId ? buildTrackedLinkHref(templateId, normalized, linkLabel || "") : normalized;
}

function serializeBlock(block: Block, templateId?: string): string {
  switch (block.type) {
    case "text":
      return `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;">${block.html}</td></tr>`;

    case "image": {
      // object-fit crops to the given height while filling the width — supported by Gmail,
      // Apple Mail, and mobile clients, but not Outlook desktop (its Word-based renderer just
      // stretches/distorts instead of cropping). No workaround for that short of shipping a
      // pre-cropped image; a known, unavoidable email-client gap, not a bug here.
      const heightStyle = block.height ? `height:${block.height}px;object-fit:cover;` : "";
      // Outlook desktop's Word-based renderer ignores border-radius on <img> same as it ignores
      // object-fit above — Gmail/Apple Mail/mobile clients render it fine. Same accepted gap.
      const radius = imageBorderRadius(block.shape);
      const img = `<img src="${block.src}" alt="${block.alt}" width="${block.width}" ${block.height ? `height="${block.height}"` : ""} style="display:block;width:${block.width}px;max-width:100%;${heightStyle}border-radius:${radius};border:0;" />`;
      // Gmail's own signature-settings sanitizer (a different code path than how it renders a
      // *received* message body) is known to strip border-radius off a raw <img> — it survives
      // more reliably on a wrapping element, so a rounded/circle image also gets clipped via an
      // overflow:hidden span with the same radius, not just the <img>'s own style.
      const wrappedImg =
        radius === "0"
          ? img
          : `<span style="display:inline-block;overflow:hidden;border-radius:${radius};width:${block.width}px;${block.height ? `height:${block.height}px;` : ""}line-height:0;">${img}</span>`;
      const href = trackedOrPlainHref(templateId, block.linkUrl, block.linkLabel);
      // The anchor needs its own explicit size matching the image — without one, wrapping a
      // block-level <img> in a bare <a> makes most mail clients block-ify the anchor too, and it
      // then stretches to fill the <td> (which itself expands to the table's width:100%), so the
      // clickable area extends well past the visible image into any empty space beside it.
      const content = href
        ? `<a href="${href}" style="display:block;width:${block.width}px;max-width:100%;${block.height ? `height:${block.height}px;` : ""}">${wrappedImg}</a>`
        : wrappedImg;
      const paddingStyle = block.padding ? `padding:${block.padding}px;` : "";
      return `<tr><td style="${paddingStyle}${ALIGN_TD(block.align)}">${content}</td></tr>`;
    }

    case "button": {
      const href = trackedOrPlainHref(templateId, block.url, block.label) || "#";
      return `<tr><td style="${ALIGN_TD(block.align)}">
        <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${block.bgColor};border-radius:6px;padding:10px 20px;">
          <a href="${href}" style="color:${block.textColor};font-size:13px;font-weight:bold;text-decoration:none;">${block.label}</a>
        </td></tr></table>
      </td></tr>`;
    }

    case "divider":
      return `<tr><td style="padding:8px 0;"><div style="border-top:1px solid ${block.color};line-height:0;font-size:0;">&nbsp;</div></td></tr>`;

    case "spacer":
      return `<tr><td style="height:${block.height}px;line-height:${block.height}px;font-size:0;">&nbsp;</td></tr>`;

    case "social": {
      if (block.icons.length === 0) return "";
      const iconsHtml = block.icons
        .map(
          (i, idx) =>
            `<td style="${idx > 0 ? "padding-left:8px;" : ""}"><a href="${i.href}"><img src="${SOCIAL_ICON(i.icon)}" width="20" height="20" alt="${i.icon}" style="display:block;" /></a></td>`
        )
        .join("");
      return `<tr><td style="${ALIGN_TD(block.align)}"><table cellpadding="0" cellspacing="0" border="0" style="${block.align === "center" ? "margin:0 auto;" : block.align === "right" ? "margin-left:auto;" : ""}"><tr>${iconsHtml}</tr></table></td></tr>`;
    }

    case "columns": {
      const widths = computeColumnWidths(block.columnStyles);
      const tds = block.columns
        .map((col, idx) => {
          const cs = block.columnStyles[idx] || {};
          const borderColor = cs.borderColor || "#e5e7eb";
          const borderWidth = cs.borderWidth || 2;
          const style = [
            "vertical-align:top",
            `width:${widths[idx]}%`,
            idx < block.columns.length - 1 ? "padding-right:12px" : "",
            cs.padding ? `padding:${cs.padding}px` : "",
            cs.backgroundColor ? `background-color:${cs.backgroundColor}` : "",
            cs.borderTop ? `border-top:${borderWidth}px solid ${borderColor}` : "",
            cs.borderRight ? `border-right:${borderWidth}px solid ${borderColor}` : "",
            cs.borderBottom ? `border-bottom:${borderWidth}px solid ${borderColor}` : "",
            cs.borderLeft ? `border-left:${borderWidth}px solid ${borderColor}` : "",
          ]
            .filter(Boolean)
            .join(";");
          return `<td style="${style};"><table cellpadding="0" cellspacing="0" border="0" width="100%">${col.map((b) => serializeBlock(b, templateId)).join("")}</table></td>`;
        })
        .join("");
      return `<tr><td><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${tds}</tr></table></td></tr>`;
    }

    case "html":
      // Passed through verbatim — this is the escape hatch for legacy/advanced content.
      return block.html;
  }
}

/** The canvas/export width when a template hasn't set its own — a real signature width, not the
 * wide canvas shown while editing. Shared with BlockEditor's live preview so they always agree. */
export const DEFAULT_CANVAS_WIDTH = 600;

/**
 * Renders a block tree into inline-styled, table-based HTML — the only layout rules email
 * clients actually respect (Outlook renders with Word's engine: no flexbox/grid, no external
 * stylesheets). This becomes the new `html` column value, the same role GrapesJS's
 * `editor.getHtml()` played before. `canvasWidth` is the "master" width nothing inside is meant
 * to exceed — set as a real pixel width on the outer table (not just 100%, which would let the
 * signature stretch to whatever width the recipient's mail client gives it).
 */
export function serializeBlocks(blocks: Block[], templateId?: string, canvasWidth: number = DEFAULT_CANVAS_WIDTH): string {
  // A lone "html" block (the legacy-template case) needs no outer wrapping table — it's
  // typically already a complete `<table>...</table>` document on its own.
  if (blocks.length === 1 && blocks[0].type === "html") {
    return blocks[0].html;
  }

  const rows = blocks.map((b) => serializeBlock(b, templateId)).join("\n");
  return `<table cellpadding="0" cellspacing="0" border="0" width="${canvasWidth}" style="width:${canvasWidth}px;max-width:100%;">\n${rows}\n</table>`;
}
