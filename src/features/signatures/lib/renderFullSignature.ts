import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { renderSignatureHtml } from "./mergeTags";
import { campaignClickUrl, getActiveCampaignsForDomain, pickWeighted, recordImpression, renderBannerHtml } from "@/features/campaigns/lib/selectCampaign";

/**
 * Renders a staff member's current signature by email — merge tags substituted, plus an
 * active campaign banner if one applies. Shared by /api/render (the gateway's per-message
 * call) and the Gmail API sync (src/features/signatures/lib/gmailSync.ts), so both delivery
 * mechanisms produce identical output from the same source of truth.
 *
 * Note for the Gmail-push path: since that signature is set once and reused by Gmail for
 * every subsequent compose (not re-rendered per message like the gateway), a rotating
 * campaign banner effectively freezes at whatever was active at sync time until the next
 * sync — an acceptable trade-off given a native client-side signature has to be static.
 */
export async function renderFullSignature(email: string): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: staff, error } = await supabase
    .from("staff")
    .select("*, signature_assignments(template_id, overrides), domains(name)")
    .eq("email", email)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!staff || !staff.signature_assignments) return null;

  const assignment = Array.isArray(staff.signature_assignments) ? staff.signature_assignments[0] : staff.signature_assignments;
  if (!assignment) return null;

  const { data: template, error: templateError } = await supabase
    .from("signature_templates")
    .select("html")
    .eq("id", assignment.template_id)
    .single();
  if (templateError) throw templateError;

  let html = renderSignatureHtml(template.html, staff);

  const activeCampaigns = await getActiveCampaignsForDomain(staff.domain_id);
  const campaign = pickWeighted(activeCampaigns);
  if (campaign) {
    html += renderBannerHtml(campaign, campaignClickUrl(campaign.id, staff.id));
    recordImpression(campaign.id);
  }

  return html;
}
