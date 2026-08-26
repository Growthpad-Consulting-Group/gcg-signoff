import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: experiments, error } = await supabase
    .from("campaign_experiments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ experiments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: experiment, error } = await supabase
    .from("campaign_experiments")
    .insert({ name: name.trim() })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ experiment }, { status: 201 });
}
