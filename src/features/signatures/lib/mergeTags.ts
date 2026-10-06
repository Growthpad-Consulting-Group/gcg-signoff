export interface MergeTagSource {
  full_name: string;
  email: string;
  role_title?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  photo_url?: string | null;
  // Internal-only — resolved below but deliberately left out of MERGE_TAGS/the visible "insert
  // merge tag" dropdown. It's only ever generated programmatically by the editor's "Insert
  // tracked link" button (see GrapesEditor.tsx), never meant for an admin to type/pick by hand.
  id?: string | null;
}

/** The merge tags a template author can drop into signature HTML, e.g. {{full_name}}. */
export const MERGE_TAGS: { tag: string; label: string; field: keyof MergeTagSource }[] = [
  { tag: "full_name", label: "Full name", field: "full_name" },
  { tag: "email", label: "Email", field: "email" },
  { tag: "role_title", label: "Role / title", field: "role_title" },
  { tag: "department", label: "Department", field: "department" },
  { tag: "phone", label: "Phone", field: "phone" },
  { tag: "mobile", label: "Mobile", field: "mobile" },
  { tag: "photo_url", label: "Photo URL", field: "photo_url" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Matches a spacer row exactly as blockSerializer.ts emits one — used to also drop the gap a
// stripped contact row leaves behind, so removing it doesn't just trade a row for a blank one.
const SPACER_ROW_RE = /^\s*<tr><td style="height:\d+px;line-height:\d+px;font-size:0;">&nbsp;<\/td><\/tr>/i;

/** Removes `<tr data-mt-row="field">...</tr>` rows (built by blockSerializer.ts for a single
 * per-staff merge field, e.g. the mobile contact row) whose field is blank for this staff member —
 * and the spacer row right after it, if any — instead of shipping empty icon/table markup to
 * every staff member regardless of whether that field applies to them. */
function stripEmptyMergeRows(html: string, staff: MergeTagSource): string {
  let result = html;
  const markerRe = /<tr[^>]*\sdata-mt-row="([a-z_]+)"[^>]*>/i;
  for (let guard = 0; guard < 100; guard++) {
    const match = markerRe.exec(result);
    if (!match) break;
    const field = match[1].toLowerCase();
    const entry = MERGE_TAGS.find((t) => t.tag === field);
    const value = entry ? staff[entry.field] : undefined;
    const startIdx = match.index;

    // Find this row's balanced closing </tr> (a contact row nests one more <tr> inside it).
    const tagRe = /<\/?tr\b[^>]*>/gi;
    tagRe.lastIndex = startIdx;
    let depth = 0;
    let endIdx = -1;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(result))) {
      if (m[0].toLowerCase().startsWith("</tr")) {
        depth--;
        if (depth === 0) {
          endIdx = m.index + m[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    if (endIdx === -1) break; // malformed/unbalanced — leave the rest of the template alone

    if (value) {
      // Field is set — keep the row, just strip the now-unneeded marker, and move past it.
      result = result.slice(0, startIdx) + result.slice(startIdx).replace(/\sdata-mt-row="[a-z_]+"/i, "");
      markerRe.lastIndex = 0;
      continue;
    }

    const spacerMatch = SPACER_ROW_RE.exec(result.slice(endIdx));
    const removeEnd = endIdx + (spacerMatch ? spacerMatch[0].length : 0);
    result = result.slice(0, startIdx) + result.slice(removeEnd);
  }
  return result;
}

/**
 * Substitutes {{tag}} placeholders in template HTML with a staff member's data. Unknown or
 * empty tags resolve to "" rather than leaving the raw placeholder visible in a sent email.
 */
export function renderSignatureHtml(templateHtml: string, staff: MergeTagSource): string {
  const withoutEmptyRows = stripEmptyMergeRows(templateHtml, staff);
  return withoutEmptyRows.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, tag: string) => {
    const lower = tag.toLowerCase();
    if (lower === "id") return staff.id ? escapeHtml(staff.id) : "";
    const entry = MERGE_TAGS.find((t) => t.tag === lower);
    if (!entry) return "";
    const value = staff[entry.field];
    return value ? escapeHtml(String(value)) : "";
  });
}
