import { config } from "./config.js";

/**
 * Asks the Signoff app for a staff member's current signature HTML. Returns null if the
 * sender has no active staff record or no assigned template — the caller should relay the
 * message unmodified in that case, not fail delivery over a missing signature.
 */
export async function fetchSignatureHtml(senderEmail: string): Promise<string | null> {
  const url = new URL(config.renderApiUrl);
  url.searchParams.set("email", senderEmail);

  const res = await fetch(url, {
    headers: { "x-render-secret": config.renderApiSecret },
  });

  if (res.status === 401) {
    throw new Error("Render API rejected the gateway's secret — check RENDER_API_SECRET matches the app's.");
  }
  if (!res.ok) {
    console.error(`[gateway] render API returned ${res.status} for ${senderEmail}`);
    return null;
  }

  const body = (await res.json()) as { html: string | null };
  return body.html || null;
}
