import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import type { CookieToSet } from "@/lib/supabase/route";

const LOGIN_INTENT_PURPOSE = "device_picker";

export interface LoginIntentClaims {
  jti: string;
  sub: string;
  purpose: typeof LOGIN_INTENT_PURPOSE;
  exp: number;
}

export interface PendingLoginSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string | null;
  cookiesToSet: CookieToSet[];
}

function getSecret() {
  const secret = process.env.LOGIN_INTENT_SECRET ?? process.env.DEVICE_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("LOGIN_INTENT_SECRET is missing or too short (need 32+ chars).");
  }
  return secret;
}

function deriveKey(label: string) {
  return createHash("sha256").update(`${getSecret()}:${label}`).digest();
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

function sign(unsignedToken: string) {
  return base64url(
    createHmac("sha256", deriveKey("jwt")).update(unsignedToken).digest()
  );
}

export function createLoginIntentToken(claims: LoginIntentClaims) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const unsignedToken = `${header}.${payload}`;
  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyLoginIntentToken(token: string): LoginIntentClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("intent_invalid");

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("intent_invalid");
  }

  const claims = JSON.parse(fromBase64url(payload).toString("utf8")) as LoginIntentClaims;
  if (claims.purpose !== LOGIN_INTENT_PURPOSE) throw new Error("intent_invalid");
  if (!claims.jti || !claims.sub || !claims.exp) throw new Error("intent_invalid");
  if (claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("intent_expired");
  return claims;
}

export function encryptPendingLoginSession(session: PendingLoginSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("cipher"), iv);
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${base64url(iv)}.${base64url(tag)}.${base64url(encrypted)}`;
}

export function decryptPendingLoginSession(ciphertext: string): PendingLoginSession {
  const [version, ivRaw, tagRaw, encryptedRaw] = ciphertext.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("intent_invalid");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey("cipher"),
    fromBase64url(ivRaw)
  );
  decipher.setAuthTag(fromBase64url(tagRaw));
  const decrypted = Buffer.concat([
    decipher.update(fromBase64url(encryptedRaw)),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as PendingLoginSession;
}
