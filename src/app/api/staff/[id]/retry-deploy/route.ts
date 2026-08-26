import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

/**
 * There's no way to force an outgoing mail send on demand — actual deployment only happens
 * when the gateway relays a real email and calls back /api/deploy-status. This just clears a
 * stuck error so the assignment is picked up fresh on this person's next outgoing message.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("signature_assignments")
    .update({ deploy_status: "pending", deploy_error: null, updated_at: new Date().toISOString() })
    .eq("staff_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
