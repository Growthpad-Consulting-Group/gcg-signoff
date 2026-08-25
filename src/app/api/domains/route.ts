import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: domains, error } = await supabase.from("domains").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domains });
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
