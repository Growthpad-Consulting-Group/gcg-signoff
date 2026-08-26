import { createServerSupabaseClient } from "@/shared/lib/supabase/server";

/** Writes one notification row per admin user. `notifications.user_id` is keyed by email. */
export async function notifyAdmins(message: string) {
  const supabase = createServerSupabaseClient();
  const { data: users } = await supabase.from("users").select("email");
  if (!users || users.length === 0) return;

  await supabase.from("notifications").insert(users.map((u) => ({ user_id: u.email, message })));
}
