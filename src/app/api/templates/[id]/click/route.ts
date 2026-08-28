import { NextRequest, NextResponse, after } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

/**
 * Public — hit directly from a recipient's email client clicking a tracked link embedded in a
 * signature (see the editor's "Insert tracked link" button), which carries no session.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = req.nextUrl.searchParams.get("to");
  const staffId = req.nextUrl.searchParams.get("staff") || null;
  const label = req.nextUrl.searchParams.get("label") || null;

  let destination: URL;
  try {
    if (!to) throw new Error("missing to");
    destination = new URL(to);
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const supabase = createServerSupabaseClient();

  // Deferred via after() rather than a bare fire-and-forget promise — on Vercel's serverless
  // runtime, the function can be frozen the instant the response is sent, which would kill an
  // un-awaited background write before it completes.
  after(async () => {
    await supabase.from("template_link_clicks").insert({
      template_id: id,
      staff_id: staffId,
      destination: destination.toString(),
      label,
    });
  });

  return NextResponse.redirect(destination);
}
