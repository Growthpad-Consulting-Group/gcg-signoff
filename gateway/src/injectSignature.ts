/** Appends a signature to an HTML body, before </body> if present, otherwise at the end. */
export function appendToHtml(html: string, signatureHtml: string): string {
  const wrapped = `<br>${signatureHtml}`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${wrapped}</body>`);
  }
  return `${html}${wrapped}`;
}

/** Strips tags for a best-effort plain-text fallback, appended to the plain-text body/alt-part. */
export function appendToText(text: string, signatureHtml: string): string {
  const plain = signatureHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${text}\n\n--\n${plain}`;
}
