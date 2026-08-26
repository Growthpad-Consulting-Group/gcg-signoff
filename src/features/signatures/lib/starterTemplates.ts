import { DEFAULT_TEMPLATE_HTML } from "./defaultTemplate";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

/**
 * Table-based, fully-inlined starter layouts — the only layout rules email clients actually
 * respect (Outlook renders with Word's engine: no flexbox/grid, no external stylesheets).
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Photo, name, and contact details side by side.",
    html: DEFAULT_TEMPLATE_HTML,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Text-only, no photo — clean and compact.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td>
      <p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#f05d23;">{{role_title}} &middot; {{department}}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
        &nbsp;|&nbsp; {{phone}}
      </p>
    </td>
  </tr>
</table>`,
  },
  {
    id: "bold-photo",
    name: "Bold with photo",
    description: "Larger photo, brand-colored divider, stacked details.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding-right:20px;">
      <img src="{{photo_url}}" width="96" height="96" alt="{{full_name}}" style="display:block;border-radius:8px;object-fit:cover;" />
    </td>
    <td style="padding-left:20px;border-left:3px solid #f05d23;">
      <p style="margin:0;font-size:17px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:4px 0 0;font-size:13px;font-weight:bold;color:#f05d23;text-transform:uppercase;letter-spacing:0.5px;">{{role_title}}</p>
      <p style="margin:2px 0 12px;font-size:12px;color:#6b7280;">{{department}}</p>
      <p style="margin:0;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
      </p>
      <p style="margin:2px 0 0;font-size:12px;color:#374151;">{{phone}} &nbsp;|&nbsp; {{mobile}}</p>
    </td>
  </tr>
</table>`,
  },
  {
    id: "two-column",
    name: "Two-column",
    description: "Details on the left, photo and socials on the right.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding-right:24px;vertical-align:top;">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#f05d23;">{{role_title}}</p>
      <p style="margin:2px 0 10px;font-size:12px;color:#6b7280;">{{department}}</p>
      <p style="margin:0;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
      </p>
      <p style="margin:2px 0 0;font-size:12px;color:#374151;">{{phone}}</p>
    </td>
    <td style="padding-left:24px;border-left:1px solid #e5e7eb;vertical-align:top;text-align:center;">
      <img src="{{photo_url}}" width="64" height="64" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;margin:0 auto;" />
    </td>
  </tr>
</table>`,
  },
];
