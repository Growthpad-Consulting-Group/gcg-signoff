import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [{ data: domains, error }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("domains").select("*").order("created_at", { ascending: false }),
    supabase.from("staff").select("domain_id"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });

  const staffCounts: Record<string, number> = {};
  for (const { domain_id } of staff || []) {
    staffCounts[domain_id] = (staffCounts[domain_id] || 0) + 1;
  }

  return NextResponse.json({ domains, staffCounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, platform } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: domain, error } = await supabase
    .from("domains")
    .insert({ name, platform: platform || "google_workspace" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domain }, { status: 201 });
}
