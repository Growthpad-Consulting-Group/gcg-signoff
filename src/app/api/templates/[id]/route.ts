import { NextRequest, NextResponse } from "next/server";
import juice from "juice";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { notifyAdmins } from "@/shared/lib/notify";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data: template, error } = await supabase.from("signature_templates").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();

  // The editor sends raw html + a separate <style> block from GrapesJS; email clients need
  // everything inlined, so fold css into html here rather than storing/sending a <style> tag.
  // `silent` (autosave ticks) is a client-only flag, not a column — strip it before writing.
  const { css, silent, ...rest } = body;
  const update = css ? { ...rest, html: juice.inlineContent(rest.html, css) } : rest;

  // On an explicit Save (not an autosave tick), snapshot what's about to be overwritten so it
  // can be restored later.
  if (!silent) {
    const { data: previous } = await supabase
      .from("signature_templates")
      .select("name, html, blocks, builder_data")
      .eq("id", id)
      .single();
    if (previous) {
      await supabase.from("signature_template_versions").insert({ template_id: id, ...previous });
    }
  }

  const { data: template, error } = await supabase
    .from("signature_templates")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Any staff whose signature comes from this template now needs to be re-deployed.
  const { data: affected } = await supabase
    .from("signature_assignments")
    .update({ deploy_status: "pending" })
    .eq("template_id", id)
    .select("id");

  // Only notify on an explicit Save, not every autosave tick while the admin is still typing.
  if (!silent && affected && affected.length > 0) {
    await notifyAdmins(`Template "${template.name}" updated — ${affected.length} staff will redeploy`);
  }

  return NextResponse.json({ template });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("signature_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
