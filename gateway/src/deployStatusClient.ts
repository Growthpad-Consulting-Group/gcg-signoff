import { config } from "./config.js";

/**
 * Reports back to the app whether a stamped message was actually relayed, so
 * signature_assignments.deploy_status reflects reality instead of staying "pending" forever.
 * Best-effort: a failure here shouldn't block or retry mail delivery, just gets logged.
 */
export async function reportDeployStatus(email: string, status: "deployed" | "error", error?: string): Promise<void> {
  try {
    const url = new URL(config.renderApiUrl);
    url.pathname = url.pathname.replace(/\/render$/, "/deploy-status");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-render-secret": config.renderApiSecret },
      body: JSON.stringify({ email, status, error }),
    });
    if (!res.ok) {
      console.error(`[gateway] deploy-status report failed (${res.status}) for ${email}`);
    }
  } catch (err) {
    console.error(`[gateway] deploy-status report errored for ${email}:`, err);
  }
}
