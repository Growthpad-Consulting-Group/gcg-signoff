/**
 * Minimal IPv4 CIDR matcher for the GATEWAY_ALLOWED_IPS allowlist. Node's net module reports
 * dual-stack socket peers as IPv4-mapped IPv6 (e.g. "::ffff:74.125.1.2"), so that gets
 * normalized to plain IPv4 before comparison. Bare IPs (no "/") are treated as exact matches.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function normalize(address: string): string {
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function isIpAllowed(remoteAddress: string, allowlist: string[]): boolean {
  const address = normalize(remoteAddress);
  const addressInt = ipv4ToInt(address);

  return allowlist.some((entry) => {
    if (!entry.includes("/")) return entry === address;

    const [rangeIp, prefixStr] = entry.split("/");
    const prefix = Number(prefixStr);
    const rangeInt = ipv4ToInt(rangeIp);
    if (addressInt === null || rangeInt === null || Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (addressInt & mask) === (rangeInt & mask);
  });
}
