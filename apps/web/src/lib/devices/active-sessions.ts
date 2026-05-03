import type { ActiveSession } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEVICE_INACTIVE_DAYS } from "./cookie";

export function activeDeviceCutoffIso() {
  return new Date(
    Date.now() - DEVICE_INACTIVE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

export async function listActiveSessionsForUser(
  admin: SupabaseClient,
  userId: string
) {
  const { data, error } = await admin
    .from("user_devices")
    .select("id, label, user_agent, created_at, last_seen_at")
    .eq("user_id", userId)
    .gte("last_seen_at", activeDeviceCutoffIso())
    .order("last_seen_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ActiveSession[];
}

export function oldestSessionId(sessions: ActiveSession[]) {
  return sessions[0]?.id ?? null;
}
