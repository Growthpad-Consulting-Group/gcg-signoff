import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

/**
 * Called by the gateway (see gateway/src/index.ts) right after it relays a message, so
 * signature_assignments.deploy_status reflects reality instead of staying "pending" forever.
 * Shares auth with /api/render — same trust boundary, same secret.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RENDER_API_SECRET;
  const provided = req.headers.get("x-render-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const status = body.status as "deployed" | "error" | undefined;
  const error = body.error as string | undefined;

  if (!email || !status || !["deployed", "error"].includes(status)) {
    return NextResponse.json({ error: "email and status ('deployed' | 'error') are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: staff, error: staffError } = await supabase.from("staff").select("id").eq("email", email).maybeSingle();
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  if (!staff) return NextResponse.json({ error: "No staff record for that email" }, { status: 404 });

  const { error: updateError } = await supabase
    .from("signature_assignments")
    .update({
      deploy_status: status,
      deploy_error: status === "error" ? error ?? "Unknown error" : null,
      last_deployed_at: status === "deployed" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("staff_id", staff.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
