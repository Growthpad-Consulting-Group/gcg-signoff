import { resolveMx } from "dns/promises";

/** Resolve MX records for a domain, sorted by priority (lower = preferred). */
export async function resolveMxServers(domain: string): Promise<{ exchange: string; priority: number }[]> {
  try {
    const records = await resolveMx(domain);
    // resolveMx returns records already sorted by priority, but let's be explicit
    return records.sort((a, b) => a.priority - b.priority);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
      throw new Error(`No MX records found for domain: ${domain}`);
    }
    throw new Error(`MX lookup failed for ${domain}: ${error.message}`);
  }
}
