import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyRouteCookies,
  createRouteClient,
} from "@/lib/supabase/route";
import { setSupabaseAuthCookies } from "@/lib/supabase/auth-cookies";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  getSessionIdFromAccessToken,
  hashIp,
  ipFromHeaders,
  signDeviceId,
  type ClientBrand,
} from "@/lib/devices/cookie";
import { CLIENT_BRAND_HEADER } from "@/lib/devices/client-hints";
import { registerDevice } from "@/lib/devices/register";
import {
  listActiveSessionsForUser,
  oldestSessionId,
} from "@/lib/devices/active-sessions";
import {
  createLoginIntentToken,
  encryptPendingLoginSession,
} from "@/lib/auth/login-intents";
import type { LoginResponse } from "@/lib/database.types";

const LOGIN_INTENT_TTL_MS = 5 * 60 * 1000;

function json(body: LoginResponse, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function normalizeRedirect(value: unknown) {
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
}

export async function POST(request: Request) {
  let body: {
    email?: string;
    password?: string;
    device_label?: string;
    redirect_to?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json(
      { status: "error", error: "invalid_body", message: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return json(
      {
        status: "error",
        error: "missing_credentials",
        message: "Ingresá email y contraseña.",
      },
      { status: 400 }
    );
  }

  const { supabase, cookiesToSet } = await createRouteClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) {
    return json(
      {
        status: "error",
        error: "invalid_credentials",
        message: "Email o contraseña incorrectos.",
      },
      { status: 401 }
    );
  }

  const sessionId = getSessionIdFromAccessToken(data.session.access_token);
  const cookieStore = await cookies();
  const brandHeader = request.headers.get(CLIENT_BRAND_HEADER);
  const brand: ClientBrand | null = brandHeader === "brave" ? "brave" : null;
  const ip = ipFromHeaders(request.headers);

  try {
    const result = await registerDevice({
      userId: data.user.id,
      signedCookie: cookieStore.get(DEVICE_COOKIE_NAME)?.value,
      userAgent: request.headers.get("user-agent"),
      ip,
      brand,
      sessionId,
      deviceLabel: body.device_label,
    });

    if (result.ok) {
      const response = json({ status: "ok" });
      applyRouteCookies(response, cookiesToSet);
      setSupabaseAuthCookies(
        response,
        data.session,
        cookieStore.getAll().map((cookie) => cookie.name)
      );
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

    const admin = createAdminClient();
    const activeSessions = await listActiveSessionsForUser(admin, data.user.id);
    const intentId = randomUUID();
    const expiresAt = new Date(Date.now() + LOGIN_INTENT_TTL_MS);
    const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000);
    const ciphertext = encryptPendingLoginSession({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      sessionId,
      cookiesToSet,
    });

    const { error: insertError } = await admin.from("login_intents").insert({
      id: intentId,
      user_id: data.user.id,
      pending_session_ciphertext: ciphertext,
      ip_hash: ip ? hashIp(ip) : null,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      throw insertError;
    }

    const loginIntentToken = createLoginIntentToken({
      jti: intentId,
      sub: data.user.id,
      purpose: "device_picker",
      exp: expiresAtSeconds,
    });

    return json({
      status: "session_limit_exceeded",
      login_intent_token: loginIntentToken,
      active_sessions: activeSessions,
      recommended_session_id: oldestSessionId(activeSessions),
    });
  } catch (caught) {
    console.error("login route error", caught, {
      redirect_to: normalizeRedirect(body.redirect_to),
    });
    return json(
      {
        status: "error",
        error: "server_error",
        message: "No pudimos iniciar sesión. Probá nuevamente.",
      },
      { status: 500 }
    );
  }
}
