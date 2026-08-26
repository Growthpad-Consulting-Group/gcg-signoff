import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { renderSignatureHtml } from "@/features/signatures/lib/mergeTags";
import { sendEmail } from "@/shared/lib/mailer";

const SAMPLE_STAFF = {
  full_name: "Jane Wanjiru",
  email: "jane.wanjiru@growthpad.co.ke",
  role_title: "Marketing Manager",
  department: "Marketing",
  phone: "+254 700 000 000",
  mobile: "+254 711 000 000",
  photo_url: "https://placehold.co/72x72/f05d23/ffffff?text=JW",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { to, staffId } = await req.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: template, error } = await supabase.from("signature_templates").select("name, html").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  let staffData = SAMPLE_STAFF;
  if (staffId) {
    const { data: staff } = await supabase
      .from("staff")
      .select("full_name, email, role_title, department, phone, mobile, photo_url")
      .eq("id", staffId)
      .maybeSingle();
    if (staff) staffData = staff;
  }

  const html = renderSignatureHtml(template.html, staffData);

  try {
    await sendEmail({ to, subject: `Signature preview: ${template.name}`, html });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
