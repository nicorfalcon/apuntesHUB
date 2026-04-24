import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string | null;
  public_key?: string | null;
  user_id: number;
  expires_in?: number | null;
  token_type: string;
  scope: string;
  live_mode: boolean;
}

/**
 * GET /api/mercadopago/oauth/callback
 * Maneja el redirect de OAuth de Mercado Pago cuando un vendedor autoriza la aplicación.
 * Intercambia el authorization code por tokens y los almacena en seller_mp_credentials.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(
      new URL("/profile?mp=error&reason=no_code", appUrl)
    );
  }

  // Validar que el usuario esté autenticado
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?redirect=/profile", appUrl)
    );
  }

  // Intercambiar authorization code por access token
  const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.MP_APP_ID!,
      client_secret: process.env.MP_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appUrl}/api/mercadopago/oauth/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    console.error(
      "Error al intercambiar código OAuth de MP:",
      await tokenResponse.text()
    );
    return NextResponse.redirect(
      new URL("/profile?mp=error&reason=token_exchange", appUrl)
    );
  }

  const data: OAuthTokenResponse = await tokenResponse.json();

  // Loguear la respuesta para debugging (sin exponer el access_token completo)
  console.log("MP OAuth response fields:", {
    has_access_token: !!data.access_token,
    has_refresh_token: !!data.refresh_token,
    has_public_key: !!data.public_key,
    user_id: data.user_id,
    expires_in: data.expires_in,
    scope: data.scope,
  });

  // expires_in puede no venir en modo test — usar 180 días por defecto
  const expiresInSeconds = data.expires_in ?? 15552000;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  // Guardar credenciales via admin client (bypasses RLS)
  // Campos opcionales: usar fallbacks para modo test donde MP puede no devolverlos
  const admin = createAdminClient();

  const { error: upsertError } = await admin
    .from("seller_mp_credentials")
    .upsert(
      {
        id: user.id,
        mp_access_token: data.access_token,
        mp_refresh_token: data.refresh_token ?? data.access_token, // fallback en modo test
        mp_public_key: data.public_key ?? process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "",
        mp_user_id: String(data.user_id),
        mp_token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    console.error("Error al guardar credenciales de MP:", upsertError);
    return NextResponse.redirect(
      new URL("/profile?mp=error&reason=save_credentials", appUrl)
    );
  }

  // Actualizar rol del usuario si es solo buyer
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "buyer") {
    await admin
      .from("profiles")
      .update({ role: "both" })
      .eq("id", user.id);
  }

  return NextResponse.redirect(
    new URL("/profile?mp=connected", appUrl)
  );
}
