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
  ipFromHeaders,
  signDeviceId,
  type ClientBrand,
} from "@/lib/devices/cookie";
import { CLIENT_BRAND_HEADER } from "@/lib/devices/client-hints";
import { registerDevice } from "@/lib/devices/register";
import {
  decryptPendingLoginSession,
  verifyLoginIntentToken,
} from "@/lib/auth/login-intents";
import type { FinalizeLoginResponse } from "@/lib/database.types";

function json(body: FinalizeLoginResponse, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function parseRpcError(message: string) {
  if (message.includes("login_intent_invalid_or_consumed")) {
    return {
      error: "intent_consumed" as const,
      message: "Esta solicitud ya fue usada o expiró. Volvé a iniciar sesión.",
      status: 409,
    };
  }
  if (message.includes("device_not_found")) {
    return {
      error: "device_not_found" as const,
      message: "Ese dispositivo ya no está disponible. Volvé a iniciar sesión.",
      status: 404,
    };
  }
  return {
    error: "server_error" as const,
    message: "No pudimos cerrar esa sesión. Probá nuevamente.",
    status: 500,
  };
}

export async function POST(request: Request) {
  let body: {
    login_intent_token?: string;
    session_to_revoke_id?: string;
    device_label?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json(
      { status: "error", error: "invalid_body", message: "Solicitud inválida." },
      { status: 400 }
    );
  }

  if (!body.login_intent_token || !body.session_to_revoke_id) {
    return json(
      {
        status: "error",
        error: "missing_fields",
        message: "Faltan datos para continuar.",
      },
      { status: 400 }
    );
  }

  let claims;
  try {
    claims = verifyLoginIntentToken(body.login_intent_token);
  } catch (error) {
    const code = error instanceof Error ? error.message : "intent_invalid";
    return json(
      {
        status: "error",
        error: code === "intent_expired" ? "intent_expired" : "intent_invalid",
        message:
          code === "intent_expired"
            ? "Tu sesión expiró, volvé a ingresar."
            : "No pudimos validar esta solicitud. Volvé al login.",
      },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { data: intent, error: lookupError } = await admin
    .from("login_intents")
    .select("id, user_id, pending_session_ciphertext, expires_at, consumed_at")
    .eq("id", claims.jti)
    .maybeSingle();

  if (lookupError) {
    return json(
      {
        status: "error",
        error: "server_error",
        message: "No pudimos validar esta solicitud.",
      },
      { status: 500 }
    );
  }

  if (!intent || intent.user_id !== claims.sub) {
    return json(
      {
        status: "error",
        error: "intent_invalid",
        message: "No pudimos validar esta solicitud. Volvé al login.",
      },
      { status: 401 }
    );
  }

  if (intent.consumed_at) {
    return json(
      {
        status: "error",
        error: "intent_consumed",
        message: "Esta solicitud ya fue usada. Volvé a iniciar sesión.",
      },
      { status: 409 }
    );
  }

  if (new Date(intent.expires_at).getTime() <= Date.now()) {
    return json(
      {
        status: "error",
        error: "intent_expired",
        message: "Tu sesión expiró, volvé a ingresar.",
      },
      { status: 401 }
    );
  }

  let pendingSession;
  try {
    pendingSession = decryptPendingLoginSession(intent.pending_session_ciphertext);
  } catch {
    return json(
      {
        status: "error",
        error: "intent_invalid",
        message: "No pudimos validar esta solicitud. Volvé al login.",
      },
      { status: 401 }
    );
  }

  const { error: rpcError } = await admin.rpc(
    "consume_login_intent_and_revoke_device",
    {
      p_intent_id: claims.jti,
      p_user_id: claims.sub,
      p_device_row_id: body.session_to_revoke_id,
    }
  );

  if (rpcError) {
    const parsed = parseRpcError(rpcError.message);
    return json(
      { status: "error", error: parsed.error, message: parsed.message },
      { status: parsed.status }
    );
  }

  const cookieStore = await cookies();
  const brandHeader = request.headers.get(CLIENT_BRAND_HEADER);
  const brand: ClientBrand | null = brandHeader === "brave" ? "brave" : null;
  const registerResult = await registerDevice({
    userId: claims.sub,
    signedCookie: cookieStore.get(DEVICE_COOKIE_NAME)?.value,
    userAgent: request.headers.get("user-agent"),
    ip: ipFromHeaders(request.headers),
    brand,
    sessionId: pendingSession.sessionId,
    deviceLabel: body.device_label,
  });

  if (!registerResult.ok) {
    return json(
      {
        status: "error",
        error: "device_limit",
        message: "No se pudo registrar este dispositivo. Volvé a iniciar sesión.",
      },
      { status: 409 }
    );
  }

  const {
    supabase,
    cookiesToSet: sessionCookiesToSet,
  } = await createRouteClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: pendingSession.accessToken,
    refresh_token: pendingSession.refreshToken,
  });

  if (sessionError || !sessionData.session) {
    console.error("finalize login setSession error", sessionError);
    return json(
      {
        status: "error",
        error: "server_error",
        message: "Se cerró la sesión elegida, pero no pudimos completar el ingreso. Volvé a iniciar sesión.",
      },
      { status: 500 }
    );
  }

  const response = json({ status: "ok" });
  applyRouteCookies(response, pendingSession.cookiesToSet);
  applyRouteCookies(response, sessionCookiesToSet);
  setSupabaseAuthCookies(
    response,
    sessionData.session,
    cookieStore.getAll().map((cookie) => cookie.name)
  );
  response.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: signDeviceId(registerResult.deviceId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
