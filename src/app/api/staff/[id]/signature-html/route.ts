import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { renderFullSignature } from "@/features/signatures/lib/renderFullSignature";

/**
 * Returns a staff member's current rendered signature HTML, for the "Copy signature" action on
 * the Staff page — the manual-paste path for domains with no automated deployment (no Google
 * Workspace, no server-level mail access), see docs/ARCHITECTURE.md. Session-cookie authed,
 * unlike /api/render which the gateway calls with its own secret.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: staff, error } = await supabase.from("staff").select("email").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  try {
    const html = await renderFullSignature(staff.email);
    if (!html) return NextResponse.json({ error: "No template assigned to this staff member" }, { status: 400 });
    return NextResponse.json({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to render signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
