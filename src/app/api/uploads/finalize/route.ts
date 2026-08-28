import { NextRequest, NextResponse, after } from "next/server";
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
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Register + respond immediately with the uploaded (not-yet-compressed) URL — the caller gets
  // an instant result instead of waiting out the download/compress/re-upload round trip, which
  // can take 20+ seconds for a large GIF. Compression then replaces the same object's bytes in
  // place afterward, so the URL never changes; callers just see it get lighter over time.
  await supabase.from("media_assets").insert({ path, public_url: data.publicUrl, filename: filename || null });

  after(async () => {
    const { data: downloaded, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    if (downloadError) return;

    const originalType = downloaded.type || "application/octet-stream";
    const buffer = Buffer.from(await downloaded.arrayBuffer());
    const { buffer: compressed, contentType } = await compressAsset(buffer, originalType);
    if (compressed.length === buffer.length) return; // compressAsset already falls back to the original when compression doesn't help

    await supabase.storage.from(BUCKET).upload(path, compressed, { contentType, upsert: true });
  });

  return NextResponse.json({ url: data.publicUrl });
}
