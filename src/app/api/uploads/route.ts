import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

const BUCKET = "signature-assets";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  // GrapesJS's default multiUpload:true appends "[]" to the field name ("files[]"); accept both.
  const files = [...formData.getAll("files"), ...formData.getAll("files[]")].filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const urls: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return NextResponse.json({ data: urls });
}
