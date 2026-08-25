import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { order } = await req.json();
  if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "order must be an array of template ids" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await Promise.all(
    order.map((id: string, index: number) =>
      supabase.from("signature_templates").update({ sort_order: index }).eq("id", id)
    )
  ).then(
    (results) => ({ error: results.find((r) => r.error)?.error || null }),
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
