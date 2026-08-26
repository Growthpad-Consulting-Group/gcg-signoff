import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [{ data: campaigns, error }, { data: stats, error: statsError }] = await Promise.all([
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("campaign_daily_stats").select("campaign_id, impressions, clicks"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 500 });

  const totals: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of stats || []) {
    const t = totals[row.campaign_id] || { impressions: 0, clicks: 0 };
    t.impressions += row.impressions;
    t.clicks += row.clicks;
    totals[row.campaign_id] = t;
  }

  return NextResponse.json({ campaigns, totals });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, image_url, link_url, domain_id, weight, starts_at, ends_at, experiment_id, variant_label } = body;

  if (!name?.trim() || !image_url?.trim() || !link_url?.trim()) {
    return NextResponse.json({ error: "name, image_url and link_url are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name: name.trim(),
      image_url: image_url.trim(),
      link_url: link_url.trim(),
      domain_id: domain_id || null,
      weight: weight || 1,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      experiment_id: experiment_id || null,
      variant_label: variant_label?.trim() || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign }, { status: 201 });
}
