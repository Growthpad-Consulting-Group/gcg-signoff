import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const domainId = req.nextUrl.searchParams.get("domain")?.trim();
  const supabase = createServerSupabaseClient();

  let request = supabase
    .from("staff")
    .select("*, signature_assignments(id, template_id, deploy_status, last_deployed_at)")
    .order("full_name", { ascending: true });

  if (query) request = request.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  if (domainId) request = request.eq("domain_id", domainId);

  const { data: staff, error } = await request;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { domain_id, email, full_name, role_title, department, phone, mobile, photo_url, template_id } = body;

  if (!domain_id || !email || !full_name) {
    return NextResponse.json({ error: "domain_id, email and full_name are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: staff, error } = await supabase
    .from("staff")
    .insert({ domain_id, email, full_name, role_title, department, phone, mobile, photo_url })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (template_id) {
    const { error: assignError } = await supabase
      .from("signature_assignments")
      .insert({ staff_id: staff.id, template_id });
    if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });
  }

  return NextResponse.json({ staff }, { status: 201 });
}
