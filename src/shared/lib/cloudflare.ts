const API_BASE = "https://api.cloudflare.com/client/v4";

interface CloudflareResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

async function cfFetch<T>(path: string, apiToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body: CloudflareResponse<T> = await res.json();
  if (!res.ok || !body.success) {
    const message = body.errors?.[0]?.message || `Cloudflare API error (${res.status})`;
    throw new Error(message);
  }
  return body.result;
}

/** Confirms the token is valid and can see this domain's zone; returns its zone id. */
export async function verifyTokenAndFindZone(apiToken: string, domainName: string): Promise<string> {
  const zones = await cfFetch<{ id: string; name: string }[]>(`/zones?name=${encodeURIComponent(domainName)}`, apiToken);
  const zone = zones[0];
  if (!zone) throw new Error(`No Cloudflare zone found for "${domainName}" — check the token has access to this zone.`);
  return zone.id;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

/** Creates or updates a TXT record by name — the first match is updated in place rather than
 * adding a duplicate, since most DNS providers (and mail clients reading SPF) expect one. */
export async function upsertTxtRecord(apiToken: string, zoneId: string, name: string, content: string): Promise<void> {
  const existing = await cfFetch<DnsRecord[]>(
    `/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(name)}`,
    apiToken
  );

  if (existing[0]) {
    await cfFetch(`/zones/${zoneId}/dns_records/${existing[0].id}`, apiToken, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  } else {
    await cfFetch(`/zones/${zoneId}/dns_records`, apiToken, {
      method: "POST",
      body: JSON.stringify({ type: "TXT", name, content, ttl: 3600 }),
    });
  }
}
