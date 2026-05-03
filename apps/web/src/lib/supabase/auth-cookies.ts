import type { Session } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

const BASE64_PREFIX = "base64-";
const COOKIE_CHUNK_SIZE = 3180;
const SUPABASE_AUTH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false,
  maxAge: SUPABASE_AUTH_COOKIE_MAX_AGE,
};

function base64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getAuthCookieName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

function isAuthCookieChunk(name: string, baseName: string) {
  return name === baseName || new RegExp(`^${baseName}\\.\\d+$`).test(name);
}

function chunkAuthCookieValue(baseName: string, value: string) {
  if (encodeURIComponent(value).length <= COOKIE_CHUNK_SIZE) {
    return [{ name: baseName, value }];
  }

  const chunks: Array<{ name: string; value: string }> = [];
  for (let start = 0; start < value.length; start += COOKIE_CHUNK_SIZE) {
    chunks.push({
      name: `${baseName}.${chunks.length}`,
      value: value.slice(start, start + COOKIE_CHUNK_SIZE),
    });
  }
  return chunks;
}

export function setSupabaseAuthCookies(
  response: NextResponse,
  session: Session,
  existingCookieNames: string[]
) {
  const baseName = getAuthCookieName();
  const cookieValue = `${BASE64_PREFIX}${base64Url(JSON.stringify(session))}`;
  const nextCookies = chunkAuthCookieValue(baseName, cookieValue);
  const nextCookieNames = new Set(nextCookies.map((cookie) => cookie.name));

  for (const name of existingCookieNames) {
    if (isAuthCookieChunk(name, baseName) && !nextCookieNames.has(name)) {
      response.cookies.set({
        name,
        value: "",
        ...AUTH_COOKIE_OPTIONS,
        maxAge: 0,
      });
    }
  }

  for (const cookie of nextCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...AUTH_COOKIE_OPTIONS,
    });
  }
}
