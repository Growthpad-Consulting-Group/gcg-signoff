"use client";

import { createClient } from "@supabase/supabase-js";

// Anon-key client for browser code. Only used for direct-to-storage uploads via a signed URL
// (see /api/uploads/sign) — everything else in this app goes through the service-role server
// client, so this stays intentionally minimal.
export function createBrowserSupabaseClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
