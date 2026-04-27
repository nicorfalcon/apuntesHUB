import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_COOKIE_NAME, verifyDeviceId } from "@/lib/devices/cookie";

const PROTECTED_ROUTES = ["/profile", "/sell", "/my-purchases", "/checkout"];

const DEVICE_SEEN_COOKIE = "ah_seen";
const DEVICE_SEEN_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión — no remover este await
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Throttled refresh of last_seen_at for the current device, so that
  // the active device clearly looks "more recent" than stale ones in
  // the user's device list.
  if (user) {
    const lastRefreshRaw = request.cookies.get(DEVICE_SEEN_COOKIE)?.value;
    const lastRefresh = lastRefreshRaw ? Number(lastRefreshRaw) : 0;
    if (Date.now() - lastRefresh > DEVICE_SEEN_THROTTLE_MS) {
      const deviceId = verifyDeviceId(
        request.cookies.get(DEVICE_COOKIE_NAME)?.value
      );
      if (deviceId) {
        try {
          const admin = createAdminClient();
          await admin
            .from("user_devices")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("device_id", deviceId);
        } catch {
          // Best-effort: never break a request because of last_seen update.
        }
        supabaseResponse.cookies.set({
          name: DEVICE_SEEN_COOKIE,
          value: Date.now().toString(),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24, // 1 day
        });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
