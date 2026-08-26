import { after } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export interface Campaign {
  id: string;
  name: string;
  image_url: string;
  link_url: string;
  weight: number;
}

/** Campaigns currently eligible to show for this domain — active, in date range, and either
 * domain-scoped to this one or unscoped (all domains). */
export async function getActiveCampaignsForDomain(domainId: string): Promise<Campaign[]> {
  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from("campaigns")
    .select("id, name, image_url, link_url, weight")
    .eq("active", true)
    .or(`domain_id.is.null,domain_id.eq.${domainId}`)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);

  return data || [];
}

/** Weighted-random pick — with 2+ active campaigns, each render has a chance proportional to
 * its weight of using that one, giving a simple rotation with no state to track. */
export function pickWeighted(campaigns: Campaign[]): Campaign | null {
  if (campaigns.length === 0) return null;
  const totalWeight = campaigns.reduce((sum, c) => sum + Math.max(c.weight, 1), 0);
  let roll = Math.random() * totalWeight;
  for (const c of campaigns) {
    roll -= Math.max(c.weight, 1);
    if (roll <= 0) return c;
  }
  return campaigns[campaigns.length - 1];
}

export function renderBannerHtml(campaign: Campaign, clickUrl: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr><td>
  <a href="${clickUrl}" style="display:inline-block;"><img src="${campaign.image_url}" alt="${campaign.name}" style="display:block;max-width:600px;width:100%;border:0;" /></a>
</td></tr></table>`;
}

export function campaignClickUrl(campaignId: string, staffId?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const url = new URL(`${base}/api/campaigns/${campaignId}/click`);
  if (staffId) url.searchParams.set("staff", staffId);
  return url.toString();
}

/** Deferred via after() rather than a bare fire-and-forget promise — on Vercel's serverless
 * runtime the function can be frozen the instant the response is sent, which would kill an
 * un-awaited background write before it completes. Never let this block or fail the render. */
export function recordImpression(campaignId: string): void {
  const supabase = createServerSupabaseClient();

  after(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("campaign_daily_stats")
      .select("id, impressions")
      .eq("campaign_id", campaignId)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("campaign_daily_stats").update({ impressions: existing.impressions + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("campaign_daily_stats").insert({ campaign_id: campaignId, date: today, impressions: 1 });
    }
  });
}
