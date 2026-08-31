import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

/**
 * Click analytics for links embedded directly in signature templates (the editor's "Insert
 * tracked link" button) — separate from campaign banner analytics (/api/campaigns/analytics),
 * since these are two independent tracking systems (see template_link_clicks vs campaigns).
 */
export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: clicks, error } = await supabase
    .from("template_link_clicks")
    .select("template_id, destination, label, clicked_at, signature_templates(name)")
    .order("clicked_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byTemplate = new Map<string, { templateId: string; templateName: string; clicks: number; lastClickedAt: string }>();
  for (const click of clicks || []) {
    const template = Array.isArray(click.signature_templates) ? click.signature_templates[0] : click.signature_templates;
    const key = click.template_id;
    const existing = byTemplate.get(key);
    if (existing) {
      existing.clicks += 1;
    } else {
      byTemplate.set(key, {
        templateId: key,
        templateName: template?.name || "(deleted template)",
        clicks: 1,
        lastClickedAt: click.clicked_at,
      });
    }
  }

  return NextResponse.json({
    total: clicks?.length || 0,
    byTemplate: Array.from(byTemplate.values()).sort((a, b) => b.clicks - a.clicks),
    recent: (clicks || []).slice(0, 20).map((c) => ({
      destination: c.destination,
      label: c.label,
      clickedAt: c.clicked_at,
      templateName: (Array.isArray(c.signature_templates) ? c.signature_templates[0] : c.signature_templates)?.name || "(deleted template)",
    })),
  });
}
