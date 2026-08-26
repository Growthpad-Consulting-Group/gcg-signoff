import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const supabase = createServerSupabaseClient();

  const { data: version, error: versionError } = await supabase
    .from("signature_template_versions")
    .select("name, html, blocks, builder_data")
    .eq("id", versionId)
    .eq("template_id", id)
    .single();
  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 404 });

  // Snapshot the current state before overwriting it, so restoring is itself undoable.
  const { data: current } = await supabase
    .from("signature_templates")
    .select("name, html, blocks, builder_data")
    .eq("id", id)
    .single();
  if (current) {
    await supabase.from("signature_template_versions").insert({ template_id: id, ...current });
  }

  const { data: template, error } = await supabase
    .from("signature_templates")
    .update({ html: version.html, blocks: version.blocks, builder_data: version.builder_data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("signature_assignments").update({ deploy_status: "pending" }).eq("template_id", id);

  return NextResponse.json({ template });
}
