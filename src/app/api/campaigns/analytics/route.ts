import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

const DAYS = 30;

export async function GET() {
  const supabase = createServerSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - (DAYS - 1));
  const sinceDate = since.toISOString().slice(0, 10);

  const [{ data: campaigns, error }, { data: dailyStats, error: statsError }] = await Promise.all([
    supabase.from("campaigns").select("id, name, active, starts_at, ends_at").order("created_at", { ascending: false }),
    supabase.from("campaign_daily_stats").select("campaign_id, date, impressions, clicks").gte("date", sinceDate).order("date", { ascending: true }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 500 });

  // Per-campaign lifetime totals need the full history, not just the last DAYS window used
  // for the chart — fetch separately rather than reusing the windowed query above.
  const { data: allStats, error: allStatsError } = await supabase.from("campaign_daily_stats").select("campaign_id, impressions, clicks");
  if (allStatsError) return NextResponse.json({ error: allStatsError.message }, { status: 500 });

  const totalsByCampaign: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of allStats || []) {
    const t = totalsByCampaign[row.campaign_id] || { impressions: 0, clicks: 0 };
    t.impressions += row.impressions;
    t.clicks += row.clicks;
    totalsByCampaign[row.campaign_id] = t;
  }

  const campaignRows = (campaigns || []).map((c) => ({
    ...c,
    impressions: totalsByCampaign[c.id]?.impressions || 0,
    clicks: totalsByCampaign[c.id]?.clicks || 0,
  }));

  const totals = campaignRows.reduce(
    (acc, c) => ({ impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks }),
    { impressions: 0, clicks: 0 }
  );

  // One row per day for the last DAYS days, summed across all campaigns, filling gaps with zero
  // so the chart doesn't skip days with no activity.
  const byDate: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of dailyStats || []) {
    const t = byDate[row.date] || { impressions: 0, clicks: 0 };
    t.impressions += row.impressions;
    t.clicks += row.clicks;
    byDate[row.date] = t;
  }
  const series: { date: string; impressions: number; clicks: number }[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    series.push({ date: dateStr, impressions: byDate[dateStr]?.impressions || 0, clicks: byDate[dateStr]?.clicks || 0 });
  }

  return NextResponse.json({ totals, series, campaigns: campaignRows });
}
