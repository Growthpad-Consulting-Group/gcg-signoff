import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { renderSignatureHtml } from "@/features/signatures/lib/mergeTags";
import { campaignClickUrl, getActiveCampaignsForDomain, pickWeighted, recordImpression, renderBannerHtml } from "@/features/campaigns/lib/selectCampaign";

/**
 * Renders a staff member's current signature HTML by sender email. This is the seam the
 * outbound mail gateway (or a preview UI) calls at send time — see docs/signature-app.md
 * for how it fits into the Google Workspace Outbound Gateway flow.
 *
 * Auth: expects `x-render-secret` to match RENDER_API_SECRET, since the gateway calls this
 * unauthenticated-by-cookie, message by message.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.RENDER_API_SECRET;
  const provided = req.headers.get("x-render-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: staff, error } = await supabase
    .from("staff")
    .select("*, signature_assignments(template_id, overrides), domains(name)")
    .eq("email", email)
    .eq("status", "active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!staff || !staff.signature_assignments) {
    return NextResponse.json({ html: null });
  }

  const assignment = Array.isArray(staff.signature_assignments) ? staff.signature_assignments[0] : staff.signature_assignments;
  if (!assignment) return NextResponse.json({ html: null });

  const { data: template, error: templateError } = await supabase
    .from("signature_templates")
    .select("html")
    .eq("id", assignment.template_id)
    .single();

  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 500 });

  let html = renderSignatureHtml(template.html, staff);

  const activeCampaigns = await getActiveCampaignsForDomain(staff.domain_id);
  const campaign = pickWeighted(activeCampaigns);
  if (campaign) {
    html += renderBannerHtml(campaign, campaignClickUrl(campaign.id, staff.id));
    recordImpression(campaign.id);
  }

  return NextResponse.json({ html });
}
