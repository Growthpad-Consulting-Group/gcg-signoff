import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { renderFullSignature } from "@/features/signatures/lib/renderFullSignature";
import { pushSignatureToGmail } from "@/features/signatures/lib/gmailSync";

/**
 * Pushes one staff member's current signature into their own Gmail "sendAs" setting — see
 * gmailSync.ts for why this exists alongside the gateway. Session-cookie authed (called from
 * the /staff UI), unlike /api/render and /api/deploy-status which the gateway calls directly.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: staff, error: staffError } = await supabase.from("staff").select("id, email").eq("id", id).single();
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 404 });

  let html: string | null;
  try {
    html = await renderFullSignature(staff.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to render signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!html) {
    return NextResponse.json({ error: "No template assigned to this staff member" }, { status: 400 });
  }

  const result = await pushSignatureToGmail(staff.email, html);

  const { error: updateError } = await supabase
    .from("signature_assignments")
    .update({
      gmail_sync_status: result.ok ? "synced" : "error",
      gmail_sync_error: result.ok ? null : result.error,
      last_gmail_synced_at: result.ok ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("staff_id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
