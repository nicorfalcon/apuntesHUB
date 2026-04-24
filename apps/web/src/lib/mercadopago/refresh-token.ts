import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_REFRESH_THRESHOLD_DAYS = 7;

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  public_key: string;
  user_id: number;
  expires_in: number;
  token_type: string;
}

/**
 * Verifica si el token del vendedor está por expirar y lo refresca si es necesario.
 * Retorna el access_token vigente (refrescado o existente).
 */
export async function getValidAccessToken(sellerId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: creds, error } = await supabase
    .from("seller_mp_credentials")
    .select("*")
    .eq("id", sellerId)
    .single();

  if (error || !creds) {
    throw new Error("Credenciales de Mercado Pago no encontradas para este vendedor");
  }

  const expiresAt = new Date(creds.mp_token_expires_at);
  const now = new Date();
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  // Si falta más del umbral, retornar el token actual
  if (daysUntilExpiry > TOKEN_REFRESH_THRESHOLD_DAYS) {
    return creds.mp_access_token;
  }

  // Refrescar el token
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_APP_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: creds.mp_refresh_token,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error al refrescar token de MP: ${response.status} - ${errorBody}`);
  }

  const data: OAuthTokenResponse = await response.json();

  const newExpiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  // Actualizar credenciales en la base de datos (upsert para manejar race conditions)
  const { error: updateError } = await supabase
    .from("seller_mp_credentials")
    .update({
      mp_access_token: data.access_token,
      mp_refresh_token: data.refresh_token,
      mp_public_key: data.public_key,
      mp_token_expires_at: newExpiresAt,
    })
    .eq("id", sellerId);

  if (updateError) {
    throw new Error(`Error al actualizar credenciales de MP: ${updateError.message}`);
  }

  return data.access_token;
}
