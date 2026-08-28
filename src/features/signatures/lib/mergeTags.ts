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

/**
 * Substitutes {{tag}} placeholders in template HTML with a staff member's data. Unknown or
 * empty tags resolve to "" rather than leaving the raw placeholder visible in a sent email.
 */
export function renderSignatureHtml(templateHtml: string, staff: MergeTagSource): string {
  return templateHtml.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, tag: string) => {
    const lower = tag.toLowerCase();
    if (lower === "id") return staff.id ? escapeHtml(staff.id) : "";
    const entry = MERGE_TAGS.find((t) => t.tag === lower);
    if (!entry) return "";
    const value = staff[entry.field];
    return value ? escapeHtml(String(value)) : "";
  });
}
