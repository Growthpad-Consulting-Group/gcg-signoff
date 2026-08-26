import { resolveNs, resolveTxt } from "dns/promises";

export type MailPlatform = "google_workspace" | "microsoft_365" | "other";

const SPF_INCLUDE_BY_PLATFORM: Record<MailPlatform, string | null> = {
  google_workspace: "include:_spf.google.com",
  microsoft_365: "include:spf.protection.outlook.com",
  other: null,
};

export const EXPECTED_SPF_BY_PLATFORM: Record<MailPlatform, string> = {
  google_workspace: "v=spf1 include:_spf.google.com ~all",
  microsoft_365: "v=spf1 include:spf.protection.outlook.com -all",
  other: "v=spf1 include:<your relay's SPF include> ~all",
};

const COMMON_DKIM_SELECTORS = ["google._domainkey", "selector1._domainkey", "selector2._domainkey", "default._domainkey"];

async function txtRecordsFor(domain: string): Promise<string[]> {
  try {
    const records = await resolveTxt(domain);
    return records.map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

export interface SpfResult {
  found: boolean;
  record: string | null;
  expected: string;
}

export async function checkSpf(domain: string, platform: MailPlatform): Promise<SpfResult> {
  const txts = await txtRecordsFor(domain);
  const spf = txts.find((t) => t.toLowerCase().startsWith("v=spf1")) || null;
  const requiredInclude = SPF_INCLUDE_BY_PLATFORM[platform];
  const found = spf !== null && (!requiredInclude || spf.toLowerCase().includes(requiredInclude));
  return { found, record: spf, expected: EXPECTED_SPF_BY_PLATFORM[platform] };
}

export interface DkimResult {
  found: boolean;
  selectors: string[];
}

export async function checkDkim(domain: string): Promise<DkimResult> {
  const found: string[] = [];
  for (const selector of COMMON_DKIM_SELECTORS) {
    const txts = await txtRecordsFor(`${selector}.${domain}`);
    if (txts.some((t) => t.toLowerCase().includes("v=dkim1"))) found.push(selector);
  }
  return { found: found.length > 0, selectors: found };
}

const NS_PROVIDER_PATTERNS: [RegExp, string][] = [
  [/cloudflare\.com$/i, "Cloudflare"],
  [/awsdns/i, "Amazon Route 53"],
  [/domaincontrol\.com$/i, "GoDaddy"],
  [/googledomains\.com$/i, "Google Domains"],
  [/azure-dns/i, "Azure DNS"],
  [/namecheaphosting\.com$/i, "Namecheap"],
];

export async function detectDnsProvider(domain: string): Promise<string | null> {
  try {
    const ns = await resolveNs(domain);
    for (const [pattern, label] of NS_PROVIDER_PATTERNS) {
      if (ns.some((n) => pattern.test(n))) return label;
    }
    return "Unknown";
  } catch {
    return null;
  }
}
