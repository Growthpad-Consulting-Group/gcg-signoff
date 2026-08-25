/**
 * Table-based, fully-inlined starter HTML — the layout rules email clients actually respect
 * (Outlook renders with Word's engine: no flexbox/grid, no external stylesheets).
 */
export const DEFAULT_TEMPLATE_HTML = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <tr>
    <td style="padding-right:16px;border-right:2px solid #f05d23;">
      <img src="{{photo_url}}" width="72" height="72" alt="{{full_name}}" style="display:block;border-radius:50%;object-fit:cover;" />
    </td>
    <td style="padding-left:16px;">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#111827;">{{full_name}}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#f05d23;">{{role_title}}</p>
      <p style="margin:2px 0 10px;font-size:12px;color:#6b7280;">{{department}}</p>
      <p style="margin:0;font-size:12px;color:#374151;">
        <a href="mailto:{{email}}" style="color:#374151;text-decoration:none;">{{email}}</a>
        &nbsp;|&nbsp; {{phone}}
      </p>
    </td>
  </tr>
</table>`;
