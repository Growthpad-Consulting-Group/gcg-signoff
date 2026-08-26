import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { upsertTxtRecord } from "@/shared/lib/cloudflare";
import { decrypt } from "@/shared/lib/crypto";
import { EXPECTED_SPF_BY_PLATFORM, checkSpf } from "@/shared/lib/dnsCheck";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: domain, error: fetchError } = await supabase
    .from("domains")
    .select("name, platform, cloudflare_api_token_encrypted, cloudflare_zone_id")
    .eq("id", id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });
  if (!domain.cloudflare_api_token_encrypted || !domain.cloudflare_zone_id) {
    return NextResponse.json({ error: "Connect Cloudflare for this domain first" }, { status: 400 });
  }

  const apiToken = decrypt(domain.cloudflare_api_token_encrypted);
  const content = EXPECTED_SPF_BY_PLATFORM[domain.platform as keyof typeof EXPECTED_SPF_BY_PLATFORM];

  try {
    await upsertTxtRecord(apiToken, domain.cloudflare_zone_id, domain.name, content);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to apply SPF record" }, { status: 500 });
  }

  // Re-verify immediately so spf_verified reflects reality without waiting for a manual check.
  const spf = await checkSpf(domain.name, domain.platform);
  await supabase.from("domains").update({ spf_verified: spf.found, updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, spfVerified: spf.found });
}
