import { MergeTagSource } from "./mergeTags";

export type MergeTagKey = keyof MergeTagSource;

export interface ProfileBlock {
  id: string;
  type: "profile";
  photoUrl: string;
  photoSize: number;
  lines: { tag: MergeTagKey; bold?: boolean; color?: string }[];
}

export interface ContactRowBlock {
  id: string;
  type: "contactRow";
  items: { tag: MergeTagKey }[];
}

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
  fontSize: number;
  color: string;
  bold: boolean;
  align: "left" | "center";
}

export interface DividerBlock {
  id: string;
  type: "divider";
  color: string;
  thickness: number;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number;
}

export type SocialPlatform = "linkedin" | "x" | "instagram" | "facebook" | "youtube";

export interface SocialIconsBlock {
  id: string;
  type: "socialIcons";
  items: { platform: SocialPlatform; url: string }[];
}

export interface HtmlBlock {
  id: string;
  type: "html";
  html: string;
}

export type SignatureBlock =
  | ProfileBlock
  | ContactRowBlock
  | TextBlock
  | DividerBlock
  | SpacerBlock
  | SocialIconsBlock
  | HtmlBlock;

export const BLOCK_TYPE_META: Record<SignatureBlock["type"], { label: string; icon: string }> = {
  profile: { label: "Profile (photo + name)", icon: "solar:user-circle-broken" },
  contactRow: { label: "Contact row", icon: "solar:phone-broken" },
  text: { label: "Text", icon: "solar:text-broken" },
  divider: { label: "Divider", icon: "solar:minus-circle-broken" },
  spacer: { label: "Spacer", icon: "solar:transfer-vertical-broken" },
  socialIcons: { label: "Social icons", icon: "solar:share-circle-broken" },
  html: { label: "Advanced HTML", icon: "solar:code-square-broken" },
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function createBlock(type: SignatureBlock["type"]): SignatureBlock {
  const id = uid();
  switch (type) {
    case "profile":
      return {
        id,
        type,
        photoUrl: "{{photo_url}}",
        photoSize: 72,
        lines: [
          { tag: "full_name", bold: true },
          { tag: "role_title", color: "#f05d23" },
          { tag: "department", color: "#6b7280" },
        ],
      };
    case "contactRow":
      return { id, type, items: [{ tag: "email" }, { tag: "phone" }] };
    case "text":
      return { id, type, content: "", fontSize: 12, color: "#374151", bold: false, align: "left" };
    case "divider":
      return { id, type, color: "#f05d23", thickness: 2 };
    case "spacer":
      return { id, type, height: 12 };
    case "socialIcons":
      return { id, type, items: [{ platform: "linkedin", url: "" }] };
    case "html":
      return { id, type, html: "" };
  }
}

export const DEFAULT_TEMPLATE_BLOCKS: SignatureBlock[] = [
  createBlock("profile"),
  createBlock("contactRow"),
  createBlock("divider"),
  createBlock("socialIcons"),
];

// Self-hosted (public/assets/icons/social) so sent signatures never depend on a third-party
// CDN's uptime or icon availability (cdn.simpleicons.org 404s on some platforms, e.g. linkedin).
function socialIconUrl(platform: SocialPlatform): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}/assets/icons/social/${platform}.png`;
}

function contactHref(tag: MergeTagKey): string | null {
  if (tag === "email") return "mailto:{{email}}";
  if (tag === "phone" || tag === "mobile") return `tel:{{${tag}}}`;
  return null;
}

function renderBlock(block: SignatureBlock): string {
  switch (block.type) {
    case "profile": {
      const lines = block.lines
        .map((l, i) => {
          const style = [
            i === 0 ? "font-size:15px;" : "font-size:12px;",
            l.bold ? "font-weight:bold;" : "",
            l.color ? `color:${l.color};` : "color:#111827;",
            i === 0 ? "" : "margin-top:2px;",
          ].join("");
          return `<p style="margin:0;${style}">{{${l.tag}}}</p>`;
        })
        .join("\n");
      return `<tr><td style="padding-right:16px;border-right:2px solid #f05d23;vertical-align:top;">
  <img src="${block.photoUrl}" width="${block.photoSize}" height="${block.photoSize}" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;" />
</td><td style="padding-left:16px;vertical-align:top;">
${lines}
</td></tr>`;
    }
    case "contactRow": {
      const parts = block.items.map((item) => {
        const href = contactHref(item.tag);
        return href
          ? `<a href="${href}" style="color:#374151;text-decoration:none;">{{${item.tag}}}</a>`
          : `{{${item.tag}}}`;
      });
      return `<tr><td colspan="2" style="padding-top:10px;font-size:12px;color:#374151;">${parts.join("&nbsp;|&nbsp;")}</td></tr>`;
    }
    case "text": {
      const style = [
        `font-size:${block.fontSize}px;`,
        `color:${block.color};`,
        block.bold ? "font-weight:bold;" : "",
        `text-align:${block.align};`,
      ].join("");
      return `<tr><td colspan="2" style="padding-top:6px;${style}">${block.content}</td></tr>`;
    }
    case "divider":
      return `<tr><td colspan="2" style="padding-top:10px;"><div style="border-top:${block.thickness}px solid ${block.color};line-height:0;font-size:0;">&nbsp;</div></td></tr>`;
    case "spacer":
      return `<tr><td colspan="2" style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td></tr>`;
    case "socialIcons": {
      const icons = block.items
        .filter((i) => i.url)
        .map(
          (i) =>
            `<a href="${i.url}" style="display:inline-block;margin-right:8px;"><img src="${socialIconUrl(i.platform)}" width="18" height="18" alt="${i.platform}" style="display:block;" /></a>`
        )
        .join("");
      return `<tr><td colspan="2" style="padding-top:10px;">${icons}</td></tr>`;
    }
    case "html":
      return `<tr><td colspan="2">${block.html}</td></tr>`;
  }
}

/** Renders an ordered block list to the same table-based, inlined HTML the app stores/sends. */
export function blocksToHtml(blocks: SignatureBlock[]): string {
  const rows = blocks.map(renderBlock).join("\n");
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
${rows}
</table>`;
}
