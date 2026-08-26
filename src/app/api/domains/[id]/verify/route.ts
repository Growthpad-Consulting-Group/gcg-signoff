import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { checkDkim, checkSpf, detectDnsProvider } from "@/shared/lib/dnsCheck";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("domains")
    .select("name, platform")
    .eq("id", id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

  const [spf, dkim, provider] = await Promise.all([
    checkSpf(existing.name, existing.platform),
    checkDkim(existing.name),
    detectDnsProvider(existing.name),
  ]);

  const { data: domain, error } = await supabase
    .from("domains")
    .update({ spf_verified: spf.found, dkim_verified: dkim.found, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, platform, gateway_status, spf_verified, dkim_verified, notes, cloudflare_zone_id, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    domain,
    provider,
    spfRecord: spf.record,
    spfExpected: spf.expected,
    dkimSelectors: dkim.selectors,
  });
}
