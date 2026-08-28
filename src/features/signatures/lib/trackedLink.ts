/**
 * Builds a tracked-click URL for a signature template — clicking it hits
 * /api/templates/[id]/click, which logs the click (template, staff, label) then redirects to
 * `destination`. `{{id}}` resolves per-recipient at send time via renderSignatureHtml (see
 * mergeTags.ts) — same mechanism campaign banners already use for their own click tracking.
 */
export function buildTrackedLinkHref(templateId: string, destination: string, label: string): string {
  const base = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin : "";
  const params = `to=${encodeURIComponent(destination)}&staff={{id}}${label.trim() ? `&label=${encodeURIComponent(label.trim())}` : ""}`;
  return `${base}/api/templates/${templateId}/click?${params}`;
}

/** Throws if `url` isn't a valid absolute URL; returns the normalized string otherwise. */
export function normalizeUrl(url: string): string {
  return new URL(url.trim()).toString();
}
