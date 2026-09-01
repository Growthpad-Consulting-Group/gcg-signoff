import { NextRequest, NextResponse, after } from "next/server";
import juice from "juice";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { notifyAdmins } from "@/shared/lib/notify";
import { renderFullSignature } from "@/features/signatures/lib/renderFullSignature";
import { pushSignatureToGmail } from "@/features/signatures/lib/gmailSync";

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
      .select("name, html, blocks, builder_data, canvas_width")
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

  // Only notify — and auto-sync Gmail — on an explicit Save, not every autosave tick while the
  // admin is still typing. Auto-syncing on every tick would both hammer the Gmail API and push
  // half-finished drafts live into people's actual signatures.
  if (!silent && affected && affected.length > 0) {
    await notifyAdmins(`Template "${template.name}" updated — ${affected.length} staff will redeploy`);

    // Deferred via after() so the save response isn't held up waiting on N Gmail API calls —
    // same pattern as campaign impression recording (src/features/campaigns/lib/selectCampaign.ts).
    after(async () => {
      const bgSupabase = createServerSupabaseClient();
      // Only re-sync staff who've been manually synced (or attempted) at least once — someone
      // whose gmail_sync_status is still the untouched default "pending" was never opted into
      // Gmail push, so a template edit shouldn't silently push their signature live for the
      // first time. Clicking "Sync" once is what opts them into auto-sync on future edits.
      const { data: staffToSync } = await bgSupabase
        .from("staff")
        .select("id, email, signature_assignments!inner(template_id, gmail_sync_status)")
        .eq("signature_assignments.template_id", id)
        .in("signature_assignments.gmail_sync_status", ["synced", "error"])
        .eq("status", "active");

      for (const person of staffToSync || []) {
        try {
          const html = await renderFullSignature(person.email);
          if (!html) continue;
          const result = await pushSignatureToGmail(person.email, html);
          await bgSupabase
            .from("signature_assignments")
            .update({
              gmail_sync_status: result.ok ? "synced" : "error",
              gmail_sync_error: result.ok ? null : result.error,
              last_gmail_synced_at: result.ok ? new Date().toISOString() : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("staff_id", person.id);
        } catch {
          // Best-effort — a render/push failure here shouldn't affect the template save that
          // already succeeded. The staff member's row will still show whatever status their
          // last successful sync left behind, not a false "synced".
        }
      }
    });
  }

  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";
  const supabase = createServerSupabaseClient();

  if (force) {
    // Force delete: unassign any staff on this template first, so the FK restrict below never
    // fires — they fall back to "unassigned" (already a handled state on the Staff page).
    await supabase.from("signature_assignments").delete().eq("template_id", id);
  }

  const { error } = await supabase.from("signature_templates").delete().eq("id", id);

  if (error) {
    // 23503 = foreign key violation — signature_assignments.template_id is `on delete restrict`.
    if (error.code === "23503") {
      const { count } = await supabase
        .from("signature_assignments")
        .select("id", { count: "exact", head: true })
        .eq("template_id", id);
      return NextResponse.json(
        { error: "This template is assigned to staff", staffCount: count ?? 0 },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
