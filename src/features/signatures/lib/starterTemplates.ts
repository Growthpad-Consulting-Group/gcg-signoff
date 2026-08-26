export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

// Email clients can't resolve relative paths, so social icons need an absolute URL.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://signoff.growthpad.co.ke";
const SOCIAL_ICON = (icon: string) => `${APP_URL}/assets/icons/social/${icon}.png`;

const ALL_SOCIALS = ["linkedin", "instagram", "facebook", "x", "youtube"];

const SOCIAL_ROW = (icons: string[], size = 20) =>
  `<table cellpadding="0" cellspacing="0" border="0"><tr>${icons
    .map((icon, i) => `<td style="${i > 0 ? "padding-left:8px;" : ""}"><a href="#"><img src="${SOCIAL_ICON(icon)}" width="${size}" height="${size}" alt="${icon}" style="display:block;" /></a></td>`)
    .join("")}</tr></table>`;

// Bold single-letter labels (P / E / M / W) in the accent color — the pattern real signature
// builders (WiseStamp included) use for contact rows instead of icon images, since it needs no
// extra assets and always renders identically across mail clients.
const CONTACT_ROW = (rows: { label: string; value: string; href?: string }[], accent: string) =>
  rows
    .map(
      (r) =>
        `<p style="margin:0 0 4px;font-size:12px;color:#374151;"><span style="color:${accent};font-weight:bold;">${r.label}</span>&nbsp; ${
          r.href ? `<a href="${r.href}" style="color:#374151;text-decoration:none;">${r.value}</a>` : r.value
        }</p>`
    )
    .join("");

// A full-width banner strip with a tagline and a solid CTA button — the bottom-of-signature
// "banner maker" element that's the signature (pun intended) WiseStamp visual, and was
// completely missing from the earlier drafts of this gallery.
const CTA_BANNER = (bg: string, textColor: string, tagline: string, buttonLabel: string, buttonBg: string, buttonColor = "#ffffff") => `
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;background-color:${bg};border-radius:6px;">
    <tr>
      <td style="padding:16px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:13px;font-weight:bold;color:${textColor};">${tagline}</td>
            <td align="right">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background-color:${buttonBg};border-radius:18px;padding:8px 16px;">
                  <a href="#" style="color:${buttonColor};font-size:12px;font-weight:bold;text-decoration:none;white-space:nowrap;">${buttonLabel}</a>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

/**
 * Table-based, fully-inlined starter layouts — the only layout rules email clients actually
 * respect (Outlook renders with Word's engine: no flexbox/grid, no external stylesheets).
 * Modeled on real signature-builder conventions (WiseStamp's gallery in particular): a full
 * divider under the header, letter-prefixed contact rows, and a bottom banner+CTA strip —
 * not just a name/title/email text block.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "banner-cta",
    name: "Banner + CTA",
    description: "Circular photo on an accent backdrop, letter-prefixed contact rows, and a bottom promo banner.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;">
  <tr>
    <td style="padding-right:18px;">
      <table cellpadding="0" cellspacing="0" border="0" width="88" height="88" style="background-color:#fff1e9;border-radius:50%;">
        <tr><td align="center" valign="middle">
          <img src="{{photo_url}}" width="72" height="72" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;" />
        </td></tr>
      </table>
    </td>
    <td style="vertical-align:middle;">
      <p style="margin:0;font-size:22px;font-weight:bold;color:#f05d23;">{{full_name}}</p>
      <p style="margin:2px 0 10px;font-size:14px;color:#111827;">{{role_title}}, {{department}}</p>
      ${CONTACT_ROW(
        [
          { label: "P", value: "{{phone}}" },
          { label: "E", value: "{{email}}", href: "mailto:{{email}}" },
        ],
        "#f05d23"
      )}
      <div style="margin-top:8px;">${SOCIAL_ROW(ALL_SOCIALS.slice(0, 3))}</div>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      ${CTA_BANNER("#fdece3", "#7c2d12", "Growthpad Consulting Group &mdash; strategy that ships.", "More info", "#f05d23")}
    </td>
  </tr>
</table>`,
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Logo block, a full divider, contact rows, and a dark promo banner.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;">
  <tr>
    <td style="width:90px;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" border="0" width="76" height="76" style="background-color:#111827;border-radius:8px;">
        <tr><td align="center" valign="middle" style="color:#f05d23;font-size:22px;font-weight:bold;">GC</td></tr>
      </table>
    </td>
    <td style="vertical-align:top;">
      <p style="margin:0;font-size:20px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">{{role_title}}, {{department}}</p>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:12px;">
      ${CONTACT_ROW(
        [
          { label: "P", value: "{{phone}}" },
          { label: "E", value: "{{email}}", href: "mailto:{{email}}" },
          { label: "W", value: "growthpad.co.ke", href: "https://growthpad.co.ke" },
        ],
        "#f05d23"
      )}
      <div style="margin-top:6px;">${SOCIAL_ROW(ALL_SOCIALS.slice(0, 3))}</div>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      ${CTA_BANNER("#111827", "#ffffff", "Grow your brand with Growthpad", "Book a call", "#f05d23")}
    </td>
  </tr>
</table>`,
  },
  {
    id: "modern-card",
    name: "Modern card",
    description: "Rounded bordered card with a tinted photo frame and pill-style contact chips.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;width:460px;border:1px solid #e5e7eb;border-radius:12px;">
  <tr>
    <td style="padding:20px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:18px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:3px;background-color:#fff7ed;border-radius:50%;">
                  <img src="{{photo_url}}" width="76" height="76" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;" />
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:17px;font-weight:bold;color:#111827;">{{full_name}}</p>
            <p style="margin:3px 0 0;font-size:13px;color:#f05d23;font-weight:bold;">{{role_title}}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">{{department}}</p>
          </td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr>
          <td style="padding:5px 10px;background-color:#f3f4f6;border-radius:14px;font-size:11px;color:#374151;">
            <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:5px 10px;background-color:#f3f4f6;border-radius:14px;font-size:11px;color:#374151;">{{phone}}</td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr><td>${SOCIAL_ROW(ALL_SOCIALS.slice(0, 4))}</td></tr>
      </table>
    </td>
  </tr>
</table>`,
  },
  {
    id: "navy",
    name: "Navy professional",
    description: "Dark navy side panel, a full divider, and letter-prefixed contact rows.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;">
  <tr>
    <td style="background-color:#0f2c4c;padding:20px;border-radius:8px 0 0 8px;width:110px;text-align:center;vertical-align:top;">
      <img src="{{photo_url}}" width="72" height="72" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin:0 auto;" />
    </td>
    <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:0;border-radius:0 8px 8px 0;padding:20px;vertical-align:middle;">
      <p style="margin:0;font-size:17px;font-weight:bold;color:#0f2c4c;">{{full_name}}</p>
      <p style="margin:3px 0 10px;font-size:13px;font-weight:bold;color:#2563eb;">{{role_title}}, {{department}}</p>
      <div style="border-top:1px solid #e5e7eb;padding-top:10px;">
        ${CONTACT_ROW(
          [
            { label: "P", value: "{{phone}}" },
            { label: "E", value: "{{email}}", href: "mailto:{{email}}" },
          ],
          "#2563eb"
        )}
      </div>
      <div style="margin-top:6px;">${SOCIAL_ROW(ALL_SOCIALS.slice(0, 4))}</div>
    </td>
  </tr>
</table>`,
  },
  {
    id: "executive",
    name: "Executive",
    description: "Serif typography, a gold-toned rule, and a quiet confidentiality line.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',serif;color:#231812;width:440px;">
  <tr>
    <td style="padding-right:20px;vertical-align:top;">
      <img src="{{photo_url}}" width="70" height="70" alt="{{full_name}}" style="display:block;border-radius:4px;object-fit:cover;" />
    </td>
    <td style="border-left:1px solid #c9a869;padding-left:20px;vertical-align:top;">
      <p style="margin:0;font-size:17px;color:#231812;">{{full_name}}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#8a6d3b;letter-spacing:0.5px;">{{role_title}}</p>
      <p style="margin:2px 0 12px;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">{{department}}</p>
      <div style="font-family:Arial,Helvetica,sans-serif;">
        ${CONTACT_ROW(
          [
            { label: "E", value: "{{email}}", href: "mailto:{{email}}" },
            { label: "P", value: "{{phone}}" },
          ],
          "#8a6d3b"
        )}
      </div>
      <p style="margin:10px 0 0;font-size:10px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;font-style:italic;">
        This message and any attachments are confidential and intended solely for the addressee.
      </p>
    </td>
  </tr>
</table>`,
  },
  {
    id: "creative-teal",
    name: "Creative teal",
    description: "Teal accent bar, rounded photo tile, and a full social icon row.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;width:460px;">
  <tr>
    <td style="width:6px;background-color:#0f766e;border-radius:6px;"></td>
    <td style="width:16px;"></td>
    <td style="vertical-align:top;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:16px;">
            <img src="{{photo_url}}" width="68" height="68" alt="{{full_name}}" style="display:block;border-radius:14px;object-fit:cover;" />
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:17px;font-weight:bold;color:#111827;">{{full_name}}</p>
            <p style="margin:3px 0 0;font-size:13px;font-weight:bold;color:#0f766e;">{{role_title}} &middot; {{department}}</p>
          </td>
        </tr>
      </table>
      <div style="margin-top:10px;">
        ${CONTACT_ROW(
          [
            { label: "E", value: "{{email}}", href: "mailto:{{email}}" },
            { label: "M", value: "{{mobile}}" },
          ],
          "#0f766e"
        )}
      </div>
      <div style="margin-top:6px;">${SOCIAL_ROW(ALL_SOCIALS)}</div>
    </td>
  </tr>
</table>`,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Text-only, no photo — a lightweight option when a full design isn't needed.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="border-top:2px solid #f05d23;padding-top:10px;">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 10px;font-size:13px;color:#f05d23;">{{role_title}} &middot; {{department}}</p>
      ${CONTACT_ROW(
        [
          { label: "E", value: "{{email}}", href: "mailto:{{email}}" },
          { label: "P", value: "{{phone}}" },
        ],
        "#f05d23"
      )}
      <div style="margin-top:6px;">${SOCIAL_ROW(ALL_SOCIALS.slice(0, 2), 16)}</div>
    </td>
  </tr>
</table>`,
  },
];
