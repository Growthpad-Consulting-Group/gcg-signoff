/**
 * Marks each injected copy so a re-processed message can be detected and skipped rather than
 * signed again. Real-world evidence this is needed: Google's Outbound Gateway can resubmit a
 * message that's already been through this gateway (retry/spooling behavior on Google's side we
 * don't control and can't fix) — without an idempotency guard, appendToHtml/appendToText would
 * blindly stack another copy on every resubmission, producing a message with the signature
 * repeated N times. This guard makes duplication impossible regardless of why a resubmission
 * happens, without needing to understand Google's internal retry semantics.
 */
const SIGNATURE_MARKER = "data-signoff-injected";

/** Appends a signature to an HTML body, before </body> if present, otherwise at the end. Returns
 * `html` unchanged if it already carries an injected copy (see SIGNATURE_MARKER above). */
export function appendToHtml(html: string, signatureHtml: string): string {
  if (html.includes(SIGNATURE_MARKER)) return html;
  const wrapped = `<br><div ${SIGNATURE_MARKER}="1">${signatureHtml}</div>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${wrapped}</body>`);
  }
  return `${html}${wrapped}`;
}

/** Strips tags for a best-effort plain-text fallback, appended to the plain-text body/alt-part.
 * Returns `text` unchanged if it already carries an injected copy — mirrors appendToHtml's
 * guard using its own marker line, since the plain-text part has no tags to hide one in. */
const TEXT_MARKER = "-- signoff-injected --";

export function appendToText(text: string, signatureHtml: string): string {
  if (text.includes(TEXT_MARKER)) return text;
  const plain = signatureHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${text}\n\n${TEXT_MARKER}\n${plain}`;
}
