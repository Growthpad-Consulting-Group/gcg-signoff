export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

// Email clients can't resolve relative paths, so social icons need an absolute URL.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://signoff.growthpad.co.ke";
const SOCIAL_ICON = (icon: string) => `${APP_URL}/assets/icons/social/${icon}.png`;

const SOCIAL_ROW = (links: { icon: string; href: string }[], size = 20) =>
  `<table cellpadding="0" cellspacing="0" border="0"><tr>${links
    .map(
      (l, i) =>
        `<td style="${i > 0 ? "padding-left:10px;" : ""}"><a href="${l.href}"><img src="${SOCIAL_ICON(l.icon)}" width="${size}" height="${size}" alt="${l.icon}" style="display:block;" /></a></td>`
    )
    .join("")}</tr></table>`;

const ALL_SOCIALS: { icon: string; href: string }[] = [
  { icon: "linkedin", href: "#" },
  { icon: "instagram", href: "#" },
  { icon: "facebook", href: "#" },
  { icon: "x", href: "#" },
  { icon: "youtube", href: "#" },
];

/**
 * Table-based, fully-inlined starter layouts — the only layout rules email clients actually
 * respect (Outlook renders with Word's engine: no flexbox/grid, no external stylesheets).
 * Each one is a complete, real-world signature design (logo/CTA/social strip where it fits),
 * not just a name-and-email block — that's what a "starter gallery" needs to actually feel like.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "corporate",
    name: "Corporate",
    description: "Logo header, a two-column contact grid, and a full-width CTA banner.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;width:480px;">
  <tr>
    <td style="padding-bottom:14px;border-bottom:2px solid #f05d23;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding-right:16px;">
            <img src="{{photo_url}}" width="64" height="64" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;" />
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:16px;font-weight:bold;color:#111827;">{{full_name}}</p>
            <p style="margin:2px 0 0;font-size:13px;font-weight:bold;color:#f05d23;">{{role_title}}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">{{department}} &nbsp;&middot;&nbsp; Growthpad Consulting Group</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="font-size:12px;color:#374151;padding-bottom:6px;width:50%;">📧&nbsp; <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a></td>
          <td style="font-size:12px;color:#374151;padding-bottom:6px;">📱&nbsp; {{mobile}}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#374151;">📞&nbsp; {{phone}}</td>
          <td style="font-size:12px;color:#374151;">🌐&nbsp; growthpad.co.ke</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:12px 16px;background-color:#f05d23;border-radius:6px;text-align:center;">
      <a href="#" style="color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none;">Book a free consultation &rarr;</a>
    </td>
  </tr>
  <tr>
    <td style="padding-top:12px;">
      ${SOCIAL_ROW(ALL_SOCIALS.slice(0, 3))}
    </td>
  </tr>
</table>`,
  },
  {
    id: "modern-card",
    name: "Modern card",
    description: "Rounded bordered card with a colored photo frame and inline contact chips.",
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
            <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">✉ {{email}}</a>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:5px 10px;background-color:#f3f4f6;border-radius:14px;font-size:11px;color:#374151;">☎ {{phone}}</td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr><td>${SOCIAL_ROW(ALL_SOCIALS.slice(0, 4), 18)}</td></tr>
      </table>
    </td>
  </tr>
</table>`,
  },
  {
    id: "vibrant-cta",
    name: "Vibrant with CTA",
    description: "Bold color banner header with an overlapping avatar and a pill call-to-action.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;width:460px;">
  <tr>
    <td style="background-color:#f05d23;border-radius:10px 10px 0 0;padding:18px 20px 28px;">
      <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;">{{full_name}}</p>
      <p style="margin:3px 0 0;font-size:13px;color:#ffe4d3;">{{role_title}} &middot; {{department}}</p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#ffffff;border:1px solid #f3f4f6;border-top:0;border-radius:0 0 10px 10px;padding:0 20px 18px;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:-24px;">
        <tr>
          <td>
            <img src="{{photo_url}}" width="64" height="64" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;border:3px solid #ffffff;" />
          </td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
        <tr>
          <td style="font-size:12px;color:#374151;padding-right:16px;">📧 <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a></td>
          <td style="font-size:12px;color:#374151;">📞 {{phone}}</td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr>
          <td style="padding:8px 18px;background-color:#111827;border-radius:20px;">
            <a href="#" style="color:#ffffff;font-size:12px;font-weight:bold;text-decoration:none;">Schedule a call</a>
          </td>
          <td style="padding-left:14px;">${SOCIAL_ROW(ALL_SOCIALS.slice(0, 3))}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  },
  {
    id: "executive",
    name: "Executive",
    description: "Serif typography, a thin gold-toned rule, and a quiet disclaimer line.",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',serif;color:#231812;width:440px;">
  <tr>
    <td style="padding-right:20px;vertical-align:top;">
      <img src="{{photo_url}}" width="70" height="70" alt="{{full_name}}" style="display:block;border-radius:4px;object-fit:cover;" />
    </td>
    <td style="border-left:1px solid #c9a869;padding-left:20px;vertical-align:top;">
      <p style="margin:0;font-size:17px;color:#231812;">{{full_name}}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#8a6d3b;letter-spacing:0.5px;">{{role_title}}</p>
      <p style="margin:2px 0 12px;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">{{department}}</p>
      <p style="margin:0;font-size:12px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a> &nbsp;|&nbsp; {{phone}}
      </p>
      <p style="margin:10px 0 0;font-size:10px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;font-style:italic;">
        This message and any attachments are confidential and intended solely for the addressee.
      </p>
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
      <p style="margin:2px 0 0;font-size:13px;color:#f05d23;">{{role_title}} &middot; {{department}}</p>
      <p style="margin:8px 0 10px;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
        &nbsp;|&nbsp; {{phone}}
      </p>
      ${SOCIAL_ROW(ALL_SOCIALS.slice(0, 2))}
    </td>
  </tr>
</table>`,
  },
];
