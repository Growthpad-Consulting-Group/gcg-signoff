import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

const BUCKET = "signature-assets";

// Issues a signed upload URL so the browser can upload directly to Supabase Storage —
// bypassing our own Vercel serverless function and its 4.5MB request-body cap, which a large
// file (e.g. a big GIF) would otherwise fail against before ever reaching our code.
export async function POST(req: NextRequest) {
  const { filename } = await req.json().catch(() => ({}));
  const ext = (filename || "").split(".").pop() || "bin";
  const path = `${crypto.randomUUID()}.${ext}`;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, token: data.token });
}
