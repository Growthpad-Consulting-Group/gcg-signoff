import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { DEFAULT_TEMPLATE_HTML } from "@/features/signatures/lib/defaultTemplate";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const supabase = createServerSupabaseClient();

  let request = supabase.from("signature_templates").select("*").order("created_at", { ascending: false });
  if (query) request = request.ilike("name", `%${query}%`);

  const { data: templates, error } = await request;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, html } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: template, error } = await supabase
    .from("signature_templates")
    .insert({ name, description, html: html || DEFAULT_TEMPLATE_HTML })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template }, { status: 201 });
}
