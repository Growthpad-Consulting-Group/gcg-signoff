import { Align, Block, ColumnStyle, ImageBlock, newBlockId } from "@/features/signatures/lib/blocks";
import { serializeBlocks } from "@/features/signatures/lib/blockSerializer";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  blocks: Block[];
  html: string; // derived from `blocks` below, for the gallery card's preview thumbnail
}

const ALL_SOCIALS = ["linkedin", "instagram", "facebook", "x", "youtube"];

// Bold single-letter labels (P/E/M/W/D) in the accent color — the pattern real signature
// builders (WiseStamp included) use for contact rows instead of icon images, since it needs no
// extra assets and always renders identically across mail clients. Lives inside a text block's
// own html, so it's still just normal editable rich text, not a special block type.
function contactHtml(rows: { label: string; value: string; href?: string }[], accent: string): string {
  return rows
    .map(
      (r) =>
        `<p style="margin:0 0 4px;font-size:12px;color:#374151;"><span style="color:${accent};font-weight:bold;">${r.label}</span>&nbsp; ${
          r.href ? `<a href="${r.href}" style="color:#374151;text-decoration:none;">${r.value}</a>` : r.value
        }</p>`
    )
    .join("");
}

// --- Small factories so each starter definition below reads as a plain layout description
// rather than repeating `{ id: newBlockId(), type: "..." , ... }` object literals everywhere. ---

function text(html: string): Block {
  return { id: newBlockId(), type: "text", html };
}

function photo(width: number, opts: Partial<Omit<ImageBlock, "id" | "type">> = {}): Block {
  return { id: newBlockId(), type: "image", src: "{{photo_url}}", alt: "{{full_name}}", width, align: "left", ...opts };
}

function button(label: string, bgColor: string, textColor: string, align: Align = "left"): Block {
  return { id: newBlockId(), type: "button", label, url: "#", bgColor, textColor, align };
}

function social(icons: string[], align: Align = "left"): Block {
  return { id: newBlockId(), type: "social", icons: icons.map((icon) => ({ icon, href: "#" })), align };
}

function divider(color: string): Block {
  return { id: newBlockId(), type: "divider", color };
}

function columns(cols: Block[][], styles: ColumnStyle[]): Block {
  return { id: newBlockId(), type: "columns", columns: cols, columnStyles: styles };
}

/**
 * Real, individually-editable block trees — not one opaque "Advanced HTML" blob — so picking a
 * starter actually gives an editable starting point in BlockEditor. A few effects the original
 * raw-HTML drafts had (a circular tinted backdrop behind the photo, a banner avatar overlapping
 * a color block via negative margin) don't map cleanly onto the current block primitives
 * (ImageBlock has no border-radius/overlap controls) and are approximated here — a tinted
 * column background behind the photo instead of a true circular frame, banners as a flat
 * colored two-column row instead of a rounded pill — rather than pixel-matched.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = (
  [
    {
      id: "banner-cta",
      name: "Banner + CTA",
      description: "Photo on a tinted backdrop, letter-prefixed contact rows, and a bottom promo banner with a button.",
      blocks: [
        columns(
          [[photo(80, { align: "center" })], [text(`<p style="margin:0;font-size:22px;font-weight:bold;color:#f05d23;">{{full_name}}</p><p style="margin:2px 0 10px;font-size:14px;color:#111827;">{{role_title}}, {{department}}</p>${contactHtml([{ label: "P", value: "{{phone}}" }, { label: "E", value: "{{email}}", href: "mailto:{{email}}" }], "#f05d23")}`)]],
          [{ backgroundColor: "#fff1e9", padding: 12 }, {}]
        ),
        social(ALL_SOCIALS.slice(0, 3)),
        columns(
          [[text(`<p style="margin:0;font-size:13px;font-weight:bold;color:#7c2d12;">Growthpad Consulting Group &mdash; strategy that ships.</p>`)], [button("More info", "#f05d23", "#ffffff", "right")]],
          [{ backgroundColor: "#fdece3", padding: 14 }, { backgroundColor: "#fdece3", padding: 14 }]
        ),
      ],
    },
    {
      id: "classic-grid",
      name: "Classic grid",
      description: "Square photo, bold accent-colored name, and a compact contact list.",
      blocks: [
        columns(
          [
            [photo(64, { height: 64 })],
            [text(`<p style="margin:0;font-size:16px;font-weight:bold;color:#f05d23;">{{full_name}}</p><p style="margin:2px 0 0;font-size:13px;color:#374151;">{{role_title}}</p>`)],
            [text(contactHtml([{ label: "P", value: "{{phone}}" }, { label: "M", value: "{{mobile}}" }, { label: "E", value: "{{email}}", href: "mailto:{{email}}" }, { label: "D", value: "{{department}}" }], "#f05d23"))],
          ],
          [{}, {}, { borderLeft: true, borderColor: "#e5e7eb", padding: 12 }]
        ),
      ],
    },
    {
      id: "corporate",
      name: "Corporate",
      description: "Logo block, a full divider, contact rows, and a dark promo banner.",
      blocks: [
        columns(
          [[text(`<p style="margin:0;text-align:center;font-size:22px;font-weight:bold;color:#f05d23;">GC</p>`)], [text(`<p style="margin:0;font-size:20px;font-weight:bold;color:#111827;">{{full_name}}</p><p style="margin:2px 0 0;font-size:13px;color:#6b7280;">{{role_title}}, {{department}}</p>`)]],
          [{ backgroundColor: "#111827", padding: 20 }, {}]
        ),
        divider("#e5e7eb"),
        text(contactHtml([{ label: "P", value: "{{phone}}" }, { label: "E", value: "{{email}}", href: "mailto:{{email}}" }, { label: "W", value: "growthpad.co.ke", href: "https://growthpad.co.ke" }], "#f05d23")),
        social(ALL_SOCIALS.slice(0, 3)),
        columns(
          [[text(`<p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">Grow your brand with Growthpad</p>`)], [button("Book a call", "#f05d23", "#ffffff", "right")]],
          [{ backgroundColor: "#111827", padding: 14 }, { backgroundColor: "#111827", padding: 14 }]
        ),
      ],
    },
    {
      id: "modern-card",
      name: "Modern card",
      description: "Tinted photo frame with pill-style contact chips and a full social row.",
      blocks: [
        columns(
          [[photo(76, { align: "center" })], [text(`<p style="margin:0;font-size:17px;font-weight:bold;color:#111827;">{{full_name}}</p><p style="margin:3px 0 0;font-size:13px;font-weight:bold;color:#f05d23;">{{role_title}}</p><p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">{{department}}</p>`)]],
          [{ backgroundColor: "#fff7ed", padding: 10 }, {}]
        ),
        text(`<p style="margin:0;font-size:11px;color:#374151;"><a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a> &nbsp;|&nbsp; {{phone}}</p>`),
        social(ALL_SOCIALS.slice(0, 4)),
      ],
    },
    {
      id: "navy",
      name: "Navy professional",
      description: "Dark navy side panel, a full divider, and letter-prefixed contact rows.",
      blocks: [
        columns(
          [[photo(72, { align: "center" })], [text(`<p style="margin:0;font-size:17px;font-weight:bold;color:#0f2c4c;">{{full_name}}</p><p style="margin:3px 0 10px;font-size:13px;font-weight:bold;color:#2563eb;">{{role_title}}, {{department}}</p>${contactHtml([{ label: "P", value: "{{phone}}" }, { label: "E", value: "{{email}}", href: "mailto:{{email}}" }], "#2563eb")}`)]],
          [{ backgroundColor: "#0f2c4c", padding: 20 }, { padding: 20 }]
        ),
        social(ALL_SOCIALS.slice(0, 4)),
      ],
    },
    {
      id: "executive",
      name: "Executive",
      description: "A gold-toned rule and a quiet confidentiality line.",
      blocks: [
        columns(
          [
            [photo(70)],
            [
              text(
                `<p style="margin:0;font-size:17px;color:#231812;">{{full_name}}</p><p style="margin:4px 0 0;font-size:12px;color:#8a6d3b;letter-spacing:0.5px;">{{role_title}}</p><p style="margin:2px 0 12px;font-size:11px;color:#9ca3af;">{{department}}</p>${contactHtml(
                  [{ label: "E", value: "{{email}}", href: "mailto:{{email}}" }, { label: "P", value: "{{phone}}" }],
                  "#8a6d3b"
                )}<p style="margin:10px 0 0;font-size:10px;color:#9ca3af;font-style:italic;">This message and any attachments are confidential and intended solely for the addressee.</p>`
              ),
            ],
          ],
          [{}, { borderLeft: true, borderColor: "#c9a869", padding: 12 }]
        ),
      ],
    },
    {
      id: "creative-teal",
      name: "Creative teal",
      description: "Teal accent bar, rounded photo tile, and a full social icon row.",
      blocks: [
        columns(
          [[photo(68, { align: "center" })], [text(`<p style="margin:0;font-size:17px;font-weight:bold;color:#111827;">{{full_name}}</p><p style="margin:3px 0 10px;font-size:13px;font-weight:bold;color:#0f766e;">{{role_title}} &middot; {{department}}</p>${contactHtml([{ label: "E", value: "{{email}}", href: "mailto:{{email}}" }, { label: "M", value: "{{mobile}}" }], "#0f766e")}`)]],
          [{ backgroundColor: "#ccfbf1", padding: 4 }, { padding: 16 }]
        ),
        social(ALL_SOCIALS),
      ],
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "Text-only, no photo — a lightweight option when a full design isn't needed.",
      blocks: [
        text(`<p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">{{full_name}}</p><p style="margin:2px 0 10px;font-size:13px;color:#f05d23;">{{role_title}} &middot; {{department}}</p>${contactHtml([{ label: "E", value: "{{email}}", href: "mailto:{{email}}" }, { label: "P", value: "{{phone}}" }], "#f05d23")}`),
        social(ALL_SOCIALS.slice(0, 2)),
      ],
    },
  ] satisfies Omit<StarterTemplate, "html">[]
).map((t) => ({ ...t, html: serializeBlocks(t.blocks) }));
