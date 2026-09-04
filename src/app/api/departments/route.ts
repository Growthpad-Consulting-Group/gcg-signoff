import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departments: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Department name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("departments")
    .insert({ name: name.trim() })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Department already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ department: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }

  const { error } = await supabase.from("departments").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
