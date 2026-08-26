import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  // `name` is immutable after creation (see Domains page) — never write it here even if a
  // stale client payload includes it.
  const { name: _ignoredName, ...rest } = body;
  const supabase = createServerSupabaseClient();

  const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

  // Changing platform changes what SPF/DKIM/gateway-active actually mean for this domain — the
  // old verification results describe the previous platform, not this one, so they'd be stale.
  if (rest.platform) {
    const { data: existing } = await supabase.from("domains").select("platform").eq("id", id).maybeSingle();
    if (existing && existing.platform !== rest.platform) {
      update.spf_verified = false;
      update.dkim_verified = false;
      update.gateway_status = "not_configured";
    }
  }

  const { data: domain, error } = await supabase
    .from("domains")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domain });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("domains").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
