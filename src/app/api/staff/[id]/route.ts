import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { template_id, ...staffFields } = body;
  const supabase = createServerSupabaseClient();

  if (Object.keys(staffFields).length > 0) {
    const { error } = await supabase
      .from("staff")
      .update({ ...staffFields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (template_id) {
    const { error: assignError } = await supabase
      .from("signature_assignments")
      .upsert(
        { staff_id: id, template_id, deploy_status: "pending", updated_at: new Date().toISOString() },
        { onConflict: "staff_id" }
      );
    if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });
  }

  const { data: staff, error } = await supabase
    .from("staff")
    .select(
      "*, signature_assignments(id, template_id, deploy_status, last_deployed_at, gmail_sync_status, gmail_sync_error, last_gmail_synced_at)"
    )
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
