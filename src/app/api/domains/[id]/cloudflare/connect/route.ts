import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { verifyTokenAndFindZone } from "@/shared/lib/cloudflare";
import { encrypt } from "@/shared/lib/crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { apiToken } = await req.json();
  if (!apiToken?.trim()) return NextResponse.json({ error: "apiToken is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: domain, error: fetchError } = await supabase.from("domains").select("name").eq("id", id).single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

  let zoneId: string;
  try {
    zoneId = await verifyTokenAndFindZone(apiToken.trim(), domain.name);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to verify token" }, { status: 400 });
  }

  const { error } = await supabase
    .from("domains")
    .update({ cloudflare_api_token_encrypted: encrypt(apiToken.trim()), cloudflare_zone_id: zoneId, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
