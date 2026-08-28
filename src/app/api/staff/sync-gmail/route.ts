import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { renderFullSignature } from "@/features/signatures/lib/renderFullSignature";
import { pushSignatureToGmail } from "@/features/signatures/lib/gmailSync";

/** Pushes every active, assigned staff member's signature to Gmail. Used after a template
 * edit, or as a periodic "make sure everyone's actually in sync" sweep. */
export async function POST() {
  const supabase = createServerSupabaseClient();

  const { data: staffList, error } = await supabase
    .from("staff")
    .select("id, email, signature_assignments(template_id)")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assigned = (staffList || []).filter((s) => {
    const assignment = Array.isArray(s.signature_assignments) ? s.signature_assignments[0] : s.signature_assignments;
    return !!assignment;
  });

  const results = await Promise.all(
    assigned.map(async (staff) => {
      try {
        const html = await renderFullSignature(staff.email);
        if (!html) return { email: staff.email, ok: false, error: "No signature to render" };

        const result = await pushSignatureToGmail(staff.email, html);
        await supabase
          .from("signature_assignments")
          .update({
            gmail_sync_status: result.ok ? "synced" : "error",
            gmail_sync_error: result.ok ? null : result.error,
            last_gmail_synced_at: result.ok ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("staff_id", staff.id);

        return { email: staff.email, ok: result.ok, error: result.error };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { email: staff.email, ok: false, error: message };
      }
    })
  );

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({ total: results.length, succeeded, results });
}
