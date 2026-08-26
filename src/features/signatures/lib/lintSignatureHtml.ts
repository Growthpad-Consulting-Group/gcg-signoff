export interface LintFinding {
  severity: "warning";
  message: string;
}

interface Rule {
  pattern: RegExp;
  message: string;
}

const RULES: Rule[] = [
  { pattern: /display\s*:\s*flex/i, message: "Uses flexbox (display:flex) — Outlook ignores it and will stack content instead." },
  { pattern: /display\s*:\s*grid/i, message: "Uses CSS grid (display:grid) — most email clients, including Outlook, ignore it." },
  { pattern: /position\s*:\s*(absolute|fixed)/i, message: "Uses absolute/fixed positioning — unsupported in most email clients and will render inline instead." },
  { pattern: /<link[^>]+stylesheet/i, message: "Links an external stylesheet — most clients strip <link> tags; styles must be inlined." },
  { pattern: /<style[\s>]/i, message: "Contains a <style> block — many clients (older Outlook, some webmail) strip embedded <style> tags." },
];

/** Lightweight, regex-based checks for patterns known to break in common email clients or hurt
 * accessibility — not a full HTML validator, just a quick heads-up before sending. */
export function lintSignatureHtml(html: string): LintFinding[] {
  const findings: LintFinding[] = [];

  for (const rule of RULES) {
    if (rule.pattern.test(html)) {
      findings.push({ severity: "warning", message: rule.message });
    }
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = imgTags.some((tag) => !/\balt\s*=/i.test(tag));
  if (missingAlt) {
    findings.push({ severity: "warning", message: "One or more images are missing an alt attribute — add one for screen readers and when images are blocked." });
  }

  return findings;
}
