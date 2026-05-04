import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  getSessionIdFromAccessToken,
  ipFromHeaders,
  signDeviceId,
} from "@/lib/devices/cookie";
import { registerDevice } from "@/lib/devices/register";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/explorar";

  if (!code) {
    console.error("[auth/callback] missing code", {
      url: request.url,
      params: Object.fromEntries(searchParams.entries()),
    });
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: exchangeError.message,
      status: exchangeError.status,
      name: exchangeError.name,
    });
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[auth/callback] getUser returned no user after exchange");
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  const isRecoveryFlow = redirect.startsWith("/reset-password");

  if (isRecoveryFlow) {
    return NextResponse.redirect(`${origin}${redirect}`);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionId = getSessionIdFromAccessToken(session?.access_token);

  const result = await registerDevice({
    userId: user.id,
    signedCookie: cookieStore.get(DEVICE_COOKIE_NAME)?.value,
    userAgent: request.headers.get("user-agent"),
    ip: ipFromHeaders(request.headers),
    sessionId,
  });

  if (!result.ok) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=device_limit`);
  }

  const response = NextResponse.redirect(`${origin}${redirect}`);
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
