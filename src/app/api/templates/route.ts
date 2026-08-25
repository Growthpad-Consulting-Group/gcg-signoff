import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { DEFAULT_TEMPLATE_HTML } from "@/features/signatures/lib/defaultTemplate";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const supabase = createServerSupabaseClient();

  let request = supabase.from("signature_templates").select("*").order("sort_order", { ascending: true });
  if (query) request = request.ilike("name", `%${query}%`);

  const [{ data: templates, error }, { data: assignments, error: assignmentsError }] = await Promise.all([
    request,
    supabase.from("signature_assignments").select("template_id"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (assignmentsError) return NextResponse.json({ error: assignmentsError.message }, { status: 500 });

  const usageCounts: Record<string, number> = {};
  for (const { template_id } of assignments || []) {
    usageCounts[template_id] = (usageCounts[template_id] || 0) + 1;
  }

  return NextResponse.json({ templates, usageCounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, html } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: last } = await supabase
    .from("signature_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;

  const { data: template, error } = await supabase
    .from("signature_templates")
    .insert({ name, description, html: html || DEFAULT_TEMPLATE_HTML, sort_order })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template }, { status: 201 });
}
