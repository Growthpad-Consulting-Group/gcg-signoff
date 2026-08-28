import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";
import { compressAsset } from "@/shared/lib/imageCompress";

const BUCKET = "signature-assets";

// Called after the browser has uploaded a file straight to storage via a signed URL (see
// /api/uploads/sign). This request body is just a path string, not the file itself, so it's
// unaffected by Vercel's request-body size cap even though the uploaded file might be huge.
export async function POST(req: NextRequest) {
  const { path, filename } = await req.json().catch(() => ({}));
  if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: downloaded, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError) return NextResponse.json({ error: downloadError.message }, { status: 500 });

  const originalType = downloaded.type || "application/octet-stream";
  const buffer = Buffer.from(await downloaded.arrayBuffer());
  const { buffer: compressed, contentType } = await compressAsset(buffer, originalType);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  await supabase.from("media_assets").insert({ path, public_url: data.publicUrl, filename: filename || null });

  return NextResponse.json({ url: data.publicUrl });
}
