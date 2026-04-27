import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";

export const DEVICE_COOKIE_NAME = "ah_device";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const DEVICE_LIMIT = 2;
export const DEVICE_INACTIVE_DAYS = 30;

function getSecret(): string {
  const secret = process.env.DEVICE_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "DEVICE_COOKIE_SECRET is missing or too short (need 32+ chars)."
    );
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hmac(deviceId: string): string {
  return base64url(createHmac("sha256", getSecret()).update(deviceId).digest());
}

export function newDeviceId(): string {
  return randomUUID();
}

export function signDeviceId(deviceId: string): string {
  return `${deviceId}.${hmac(deviceId)}`;
}

export function verifyDeviceId(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const id = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = hmac(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip + getSecret()).digest("hex").slice(0, 32);
}

export function ipFromHeaders(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? null;
}

/**
 * Extracts the Supabase session_id from a JWT access token without
 * verifying it (verification is done by Supabase's getUser()). We only
 * need this claim to be able to revoke that specific session later.
 */
export function getSessionIdFromAccessToken(
  accessToken: string | null | undefined
): string | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      Buffer.from(payload, "base64").toString("utf8")
    ) as { session_id?: string };
    return decoded.session_id ?? null;
  } catch {
    return null;
  }
}

export type ClientBrand = "brave";

// Minimal UA parser — produces a human label like "Chrome en Windows".
// We do not aim for perfection: this is for visual identification only,
// never for device identity.
//
// `brand` is an optional client-supplied hint for browsers that mask
// themselves in the User-Agent (e.g. Brave reports as Chrome).
export function parseUserAgentLabel(
  ua: string | null | undefined,
  brand?: ClientBrand | null
): string {
  if (!ua) return "Dispositivo desconocido";

  let browser = "Navegador";
  if (brand === "brave") browser = "Brave";
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "sistema desconocido";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} en ${os}`;
}
