import { randomBytes, createHash } from "crypto";
import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

export const SESSION_COOKIE_NAME = "session_token";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("sessions").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { token, expiresAt };
}

export async function getUserForSessionToken(token: string) {
  const supabase = createServerSupabaseClient();
  // Single embedded-join query instead of two sequential round-trips (session lookup, then
  // user lookup) — this runs on nearly every request via proxy.ts, so it matters app-wide.
  const { data: session } = await supabase
    .from("sessions")
    .select("expires_at, users(id, email, name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const user = Array.isArray(session.users) ? session.users[0] : session.users;
  return user ?? null;
}

export async function deleteSession(token: string) {
  const supabase = createServerSupabaseClient();
  await supabase.from("sessions").delete().eq("token_hash", hashToken(token));
}
