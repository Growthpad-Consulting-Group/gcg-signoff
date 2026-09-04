import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: clicks, error } = await supabase
    .from("template_link_clicks")
    .select("destination, label, clicked_at")
    .order("clicked_at", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Summary stats
  const totalClicks = clicks?.length || 0;

  // Top clicked links (deduplicate by destination, count clicks)
  const clicksByLink = new Map<string, { label: string; count: number }>();
  clicks?.forEach((click) => {
    const key = click.destination;
    const current = clicksByLink.get(key) || { label: click.label || "Unlabeled", count: 0 };
    clicksByLink.set(key, { ...current, count: current.count + 1 });
  });

  const topLinks = Array.from(clicksByLink.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((link) => ({
      label: link.label,
      clicks: link.count,
    }));

  // Clicks this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthClicks = clicks?.filter((c) => new Date(c.clicked_at) >= monthStart).length || 0;

  return NextResponse.json({
    totalClicks,
    thisMonthClicks,
    topLinks,
  });
}
