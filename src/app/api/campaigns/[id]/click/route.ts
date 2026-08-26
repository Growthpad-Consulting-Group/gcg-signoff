import { NextRequest, NextResponse, after } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

/** Public — hit directly from a recipient's email client, which carries no session. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staffId = req.nextUrl.searchParams.get("staff") || null;

  const supabase = createServerSupabaseClient();
  const { data: campaign } = await supabase.from("campaigns").select("link_url").eq("id", id).maybeSingle();

  if (!campaign) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Deferred via after() rather than a bare fire-and-forget promise — on Vercel's serverless
  // runtime, the function can be frozen the instant the response is sent, which would kill an
  // un-awaited background write before it completes.
  after(async () => {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("campaign_clicks").insert({ campaign_id: id, staff_id: staffId });

    const { data: existing } = await supabase
      .from("campaign_daily_stats")
      .select("id, clicks")
      .eq("campaign_id", id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("campaign_daily_stats").update({ clicks: existing.clicks + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("campaign_daily_stats").insert({ campaign_id: id, date: today, clicks: 1 });
    }
  });

  let destination: URL;
  try {
    destination = new URL(campaign.link_url);
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.redirect(destination);
}
