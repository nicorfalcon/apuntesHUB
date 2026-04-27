import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  getSessionIdFromAccessToken,
  ipFromHeaders,
  signDeviceId,
  type ClientBrand,
} from "@/lib/devices/cookie";
import { CLIENT_BRAND_HEADER } from "@/lib/devices/client-hints";
import { registerDevice } from "@/lib/devices/register";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const signed = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  const brandHeader = request.headers.get(CLIENT_BRAND_HEADER);
  const brand: ClientBrand | null = brandHeader === "brave" ? "brave" : null;

  // getUser() above validated the JWT remotely; getSession() just reads it
  // back from the cookie store so we can pull the session_id claim.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionId = getSessionIdFromAccessToken(session?.access_token);

  const result = await registerDevice({
    userId: user.id,
    signedCookie: signed,
    userAgent: request.headers.get("user-agent"),
    ip: ipFromHeaders(request.headers),
    brand,
    sessionId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, limit: result.limit },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ ok: true, isNew: result.isNew });
  response.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: signDeviceId(result.deviceId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
