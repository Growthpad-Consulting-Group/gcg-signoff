import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: source, error: sourceError } = await supabase
    .from("signature_templates")
    .select("name, description, html, blocks")
    .eq("id", id)
    .single();
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 404 });

  const { data: last } = await supabase
    .from("signature_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;

  const { data: template, error } = await supabase
    .from("signature_templates")
    .insert({
      name: `${source.name} (copy)`,
      description: source.description,
      html: source.html,
      blocks: source.blocks,
      sort_order,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template }, { status: 201 });
}
