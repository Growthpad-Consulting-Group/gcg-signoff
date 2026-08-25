export interface MergeTagSource {
  full_name: string;
  email: string;
  role_title?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  photo_url?: string | null;
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
    const entry = MERGE_TAGS.find((t) => t.tag === tag.toLowerCase());
    if (!entry) return "";
    const value = staff[entry.field];
    return value ? escapeHtml(String(value)) : "";
  });
}
