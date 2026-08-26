export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

// Email clients can't resolve relative paths, so social icons need an absolute URL.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://signoff.growthpad.co.ke";
const SOCIAL_ICON = (icon: string) => `${APP_URL}/assets/icons/social/${icon}.png`;

const SOCIAL_ROW = (links: { icon: string; href: string }[]) =>
  `<table cellpadding="0" cellspacing="0" border="0"><tr>${links
    .map(
      (l, i) =>
        `<td style="${i > 0 ? "padding-left:8px;" : ""}"><a href="${l.href}"><img src="${SOCIAL_ICON(l.icon)}" width="20" height="20" alt="${l.icon}" style="display:block;" /></a></td>`
    )
    .join("")}</tr></table>`;

/**
 * Table-based, fully-inlined starter layouts — the only layout rules email clients actually
 * respect (Outlook renders with Word's engine: no flexbox/grid, no external stylesheets).
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Photo, name, and contact details with a brand-colored accent band.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding:16px;background-color:#fff7ed;border-left:4px solid #f05d23;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:16px;">
            <img src="{{photo_url}}" width="72" height="72" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;border:2px solid #ffffff;" />
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:16px;font-weight:bold;color:#111827;">{{full_name}}</p>
            <p style="margin:2px 0 0;font-size:13px;font-weight:bold;color:#f05d23;">{{role_title}}</p>
            <p style="margin:2px 0 10px;font-size:12px;color:#6b7280;">{{department}}</p>
            <p style="margin:0;font-size:12px;color:#374151;">
              📧 <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
              &nbsp;&nbsp; 📞 {{phone}}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Text-only, no photo — clean and compact with subtle social links.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="border-top:2px solid #f05d23;padding-top:10px;">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#f05d23;">{{role_title}} &middot; {{department}}</p>
      <p style="margin:8px 0 10px;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
        &nbsp;|&nbsp; {{phone}}
      </p>
      ${SOCIAL_ROW([
        { icon: "linkedin", href: "#" },
        { icon: "x", href: "#" },
      ])}
    </td>
  </tr>
</table>`,
  },
  {
    id: "bold-photo",
    name: "Bold with photo",
    description: "Large circular photo, uppercase role label, and a full social row.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding-right:20px;vertical-align:top;">
      <img src="{{photo_url}}" width="96" height="96" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;" />
    </td>
    <td style="padding-left:20px;border-left:3px solid #f05d23;vertical-align:top;">
      <p style="margin:0;font-size:18px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:4px 0 0;font-size:12px;font-weight:bold;color:#f05d23;text-transform:uppercase;letter-spacing:0.8px;">{{role_title}}</p>
      <p style="margin:2px 0 12px;font-size:12px;color:#6b7280;">{{department}}</p>
      <p style="margin:0;font-size:12px;color:#374151;">
        📧 <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
      </p>
      <p style="margin:4px 0 10px;font-size:12px;color:#374151;">📞 {{phone}} &nbsp;|&nbsp; 📱 {{mobile}}</p>
      ${SOCIAL_ROW([
        { icon: "linkedin", href: "#" },
        { icon: "instagram", href: "#" },
        { icon: "facebook", href: "#" },
      ])}
    </td>
  </tr>
</table>`,
  },
  {
    id: "two-column",
    name: "Two-column",
    description: "Details on the left, photo and a tinted accent panel on the right.",
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
    <td style="padding:16px;background-color:#fff7ed;border-radius:8px;vertical-align:top;text-align:center;">
      <img src="{{photo_url}}" width="64" height="64" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;margin:0 auto 8px;" />
      ${SOCIAL_ROW([
        { icon: "linkedin", href: "#" },
        { icon: "x", href: "#" },
      ])}
    </td>
  </tr>
</table>`,
  },
  {
    id: "social",
    name: "Social",
    description: "Built around a full social icon strip — for teams that lead with their brand's socials.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding-right:16px;">
      <img src="{{photo_url}}" width="80" height="80" alt="{{full_name}}" style="display:block;border-radius:12px;object-fit:cover;" />
    </td>
    <td style="vertical-align:top;">
      <p style="margin:0;font-size:16px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#f05d23;">{{role_title}} &middot; {{department}}</p>
      <p style="margin:8px 0 10px;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
        &nbsp;|&nbsp; {{phone}}
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e7eb;padding-top:10px;">
        <tr><td>
          ${SOCIAL_ROW([
            { icon: "linkedin", href: "#" },
            { icon: "instagram", href: "#" },
            { icon: "facebook", href: "#" },
            { icon: "x", href: "#" },
            { icon: "youtube", href: "#" },
          ])}
        </td></tr>
      </table>
    </td>
  </tr>
</table>`,
  },
];
