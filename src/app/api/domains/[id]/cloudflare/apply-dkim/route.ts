import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { upsertTxtRecord } from "@/shared/lib/cloudflare";
import { decrypt } from "@/shared/lib/crypto";
import { checkDkim } from "@/shared/lib/dnsCheck";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recordName, value } = await req.json();
  if (!recordName?.trim() || !value?.trim()) {
    return NextResponse.json({ error: "recordName and value are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: domain, error: fetchError } = await supabase
    .from("domains")
    .select("name, cloudflare_api_token_encrypted, cloudflare_zone_id")
    .eq("id", id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });
  if (!domain.cloudflare_api_token_encrypted || !domain.cloudflare_zone_id) {
    return NextResponse.json({ error: "Connect Cloudflare for this domain first" }, { status: 400 });
  }

  const apiToken = decrypt(domain.cloudflare_api_token_encrypted);
  const fullName = `${recordName.trim()}.${domain.name}`;

  try {
    await upsertTxtRecord(apiToken, domain.cloudflare_zone_id, fullName, value.trim());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to apply DKIM record" }, { status: 500 });
  }

  const dkim = await checkDkim(domain.name);
  await supabase.from("domains").update({ dkim_verified: dkim.found, updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, dkimVerified: dkim.found });
}
