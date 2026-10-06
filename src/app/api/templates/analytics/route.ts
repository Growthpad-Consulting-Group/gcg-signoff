import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: clicks, error } = await supabase
    .from("template_link_clicks")
    .select("template_id, destination, label, clicked_at, signature_templates(name)")
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

  // Per-template breakdown — supabase's embedded-resource typing comes back as an array even
  // though template_id is a single not-null FK, hence the `[0]` below.
  type ClickRow = { template_id: string; destination: string; label: string | null; clicked_at: string; signature_templates: { name: string } | { name: string }[] | null };
  const templateName = (row: ClickRow) => (Array.isArray(row.signature_templates) ? row.signature_templates[0]?.name : row.signature_templates?.name) || "Untitled";

  const byTemplateMap = new Map<string, { templateId: string; templateName: string; clicks: number; lastClickedAt: string }>();
  (clicks as ClickRow[] | null)?.forEach((click) => {
    const existing = byTemplateMap.get(click.template_id);
    if (existing) {
      existing.clicks += 1;
      if (click.clicked_at > existing.lastClickedAt) existing.lastClickedAt = click.clicked_at;
    } else {
      byTemplateMap.set(click.template_id, { templateId: click.template_id, templateName: templateName(click), clicks: 1, lastClickedAt: click.clicked_at });
    }
  });
  const byTemplate = Array.from(byTemplateMap.values()).sort((a, b) => b.clicks - a.clicks);

  const recent = ((clicks as ClickRow[] | null) || []).slice(0, 50).map((click) => ({
    destination: click.destination,
    label: click.label,
    clickedAt: click.clicked_at,
    templateName: templateName(click),
  }));

  return NextResponse.json({
    totalClicks,
    thisMonthClicks,
    topLinks,
    total: totalClicks,
    byTemplate,
    recent,
  });
}
