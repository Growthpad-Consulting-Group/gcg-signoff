/**
 * Builds a tracked-click URL for a signature template — clicking it hits
 * /api/templates/[id]/click, which logs the click (template, staff, label) then redirects to
 * `destination`. `{{id}}` resolves per-recipient at send time via renderSignatureHtml (see
 * mergeTags.ts) — same mechanism campaign banners already use for their own click tracking.
 */
// Deliberately hardcoded, ignoring both NEXT_PUBLIC_APP_URL and window.location.origin — this
// URL gets baked permanently into stored template HTML the moment it's inserted, and that
// content ships to production regardless of which environment authored it. NEXT_PUBLIC_APP_URL
// is *correctly* localhost during local dev for other purposes (redirects, etc.), but using it
// here means editing locally silently bakes a dead localhost link into content real recipients
// will click. This one link always needs the real deployed URL, never "wherever this happens
// to be running right now".
const PRODUCTION_APP_URL = "https://signoff.growthpad.co.ke";

export function buildTrackedLinkHref(templateId: string, destination: string, label: string): string {
  const base = PRODUCTION_APP_URL;
  const params = `to=${encodeURIComponent(destination)}&staff={{id}}${label.trim() ? `&label=${encodeURIComponent(label.trim())}` : ""}`;
  return `${base}/api/templates/${templateId}/click?${params}`;
}

/** Throws if `url` isn't a valid absolute URL; returns the normalized string otherwise. */
export function normalizeUrl(url: string): string {
  return new URL(url.trim()).toString();
}
