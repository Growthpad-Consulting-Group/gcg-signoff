import { google } from "googleapis";

/**
 * Pushes a staff member's rendered signature straight into their Gmail account's own
 * signature setting via the Gmail API, instead of intercepting mail in transit.
 *
 * Why this exists alongside the gateway (see gateway/): the gateway works for every client
 * on every device, but a brand-new sending IP has to earn Google's trust over days before
 * delivery is reliably fast (see docs/ARCHITECTURE.md / gateway/README.md for the full story).
 * This path has none of that — Google is the only sender the whole time, so there's nothing
 * to warm up. The trade-off: it only takes effect when someone composes through Gmail's own
 * web/app client, not a third-party IMAP client (Outlook desktop, Apple Mail, etc).
 *
 * Requires domain-wide delegation: a Google Cloud service account authorized in the Workspace
 * Admin console (Security → API controls → Domain-wide Delegation) for the
 * `https://www.googleapis.com/auth/gmail.settings.basic` scope — Google specifically allows
 * the `signature` field of sendAs.patch to be updated with this less-sensitive scope, unlike
 * every other field on that resource (delegates, forwarding, etc.), which needs the sensitive
 * `gmail.settings.sharing` scope instead. See docs/ARCHITECTURE.md for the setup steps. This
 * is an internal admin tool for one domain, so it does NOT need Google's public OAuth app
 * verification/security-assessment process — that only applies to apps requesting consent
 * from accounts outside your own organization.
 */

const SCOPES = ["https://www.googleapis.com/auth/gmail.settings.basic"];

function getServiceAccountCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are not configured");
  }
  return { email, privateKey };
}

/** Builds a Gmail API client authenticated as `staffEmail`, via domain-wide delegation. */
function getGmailClientFor(staffEmail: string) {
  const { email, privateKey } = getServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
    subject: staffEmail, // impersonate this specific mailbox — this is what delegation grants
  });
  return google.gmail({ version: "v1", auth });
}

// Gmail's own hard cap on sendAs.signature — checked up front so a too-long signature fails with
// a message that says what to actually do about it, instead of surfacing Gmail's raw API error.
const GMAIL_SIGNATURE_MAX_LENGTH = 10000;

export interface GmailSyncResult {
  ok: boolean;
  error?: string;
}

/** Pushes `html` as the given staff email's Gmail "sendAs" signature. */
export async function pushSignatureToGmail(staffEmail: string, html: string): Promise<GmailSyncResult> {
  if (html.length > GMAIL_SIGNATURE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Signature is ${html.length} characters, over Gmail's ${GMAIL_SIGNATURE_MAX_LENGTH}-character limit. Trim the template in the signature editor (fewer blocks, shorter text, or a lighter image row) and try again.`,
    };
  }
  try {
    const gmail = getGmailClientFor(staffEmail);
    await gmail.users.settings.sendAs.patch({
      userId: "me",
      sendAsEmail: staffEmail,
      requestBody: { signature: html },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
