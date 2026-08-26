import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { staff_ids, template_id } = await req.json();
  if (!Array.isArray(staff_ids) || staff_ids.length === 0 || !template_id) {
    return NextResponse.json({ error: "staff_ids (non-empty array) and template_id are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("signature_assignments").upsert(
    staff_ids.map((staff_id: string) => ({
      staff_id,
      template_id,
      deploy_status: "pending",
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "staff_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: staff_ids.length });
}
