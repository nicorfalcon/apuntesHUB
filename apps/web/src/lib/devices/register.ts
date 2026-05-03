import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEVICE_INACTIVE_DAYS,
  DEVICE_LIMIT,
  hashIp,
  newDeviceId,
  parseUserAgentLabel,
  verifyDeviceId,
  type ClientBrand,
} from "./cookie";

export type RegisterDeviceResult =
  | {
      ok: true;
      deviceId: string;
      isNew: boolean;
    }
  | {
      ok: false;
      reason: "device_limit";
      limit: number;
    };

interface RegisterDeviceInput {
  userId: string;
  signedCookie: string | undefined | null;
  userAgent: string | null;
  ip: string | null;
  brand?: ClientBrand | null;
  sessionId?: string | null;
  deviceLabel?: string | null;
}

/**
 * Validates the device cookie, enforces the per-user device limit, and
 * upserts the corresponding row in `user_devices`. Returns the new
 * deviceId so the caller can sign it and set the cookie on the response.
 */
export async function registerDevice(
  input: RegisterDeviceInput
): Promise<RegisterDeviceResult> {
  const admin = createAdminClient();
  const existingId = verifyDeviceId(input.signedCookie);
  const label = input.deviceLabel || parseUserAgentLabel(input.userAgent, input.brand);
  const ipHash = input.ip ? hashIp(input.ip) : null;
  const nowIso = new Date().toISOString();

  // Try existing device first.
  if (existingId) {
    const { data: existing } = await admin
      .from("user_devices")
      .select("id, user_id")
      .eq("user_id", input.userId)
      .eq("device_id", existingId)
      .maybeSingle();

    if (existing) {
      await admin
        .from("user_devices")
        .update({
          last_seen_at: nowIso,
          label,
          user_agent: input.userAgent,
          ip_hash: ipHash,
          // Sessions rotate on each login, so always refresh.
          ...(input.sessionId ? { session_id: input.sessionId } : {}),
        })
        .eq("id", existing.id);
      return { ok: true, deviceId: existingId, isNew: false };
    }
  }

  // New device: enforce limit on active devices.
  const cutoff = new Date(
    Date.now() - DEVICE_INACTIVE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { count } = await admin
    .from("user_devices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .gte("last_seen_at", cutoff);

  if ((count ?? 0) >= DEVICE_LIMIT) {
    return { ok: false, reason: "device_limit", limit: DEVICE_LIMIT };
  }

  const newId = newDeviceId();
  const { error } = await admin.from("user_devices").insert({
    user_id: input.userId,
    device_id: newId,
    label,
    user_agent: input.userAgent,
    ip_hash: ipHash,
    session_id: input.sessionId ?? null,
  });

  if (error) {
    throw new Error(`Failed to register device: ${error.message}`);
  }

  return { ok: true, deviceId: newId, isNew: true };
}
