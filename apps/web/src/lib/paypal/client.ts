import {
  getPayPalApiBase,
  getPartnerClientId,
  getPartnerClientSecret,
  getPayPalBnCode,
} from "./config";

/**
 * Token de acceso de PARTNER (client_credentials). Se cachea en memoria del proceso
 * hasta poco antes de expirar para evitar pedir uno en cada request.
 *
 * Análogo a getValidAccessToken de Mercado Pago, pero acá el token es de la plataforma,
 * no de cada vendedor.
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cache: CachedToken | null = null;

// Margen de seguridad: renovar 60s antes del vencimiento real.
const EXPIRY_MARGIN_MS = 60_000;

export async function getPartnerAccessToken(): Promise<string> {
  if (cache && cache.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cache.accessToken;
  }

  const auth = Buffer.from(
    `${getPartnerClientId()}:${getPartnerClientSecret()}`
  ).toString("base64");

  const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    // El token no debe cachearse en la capa de fetch de Next.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudo obtener token de PayPal: ${res.status} - ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number; // segundos
  };

  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Headers comunes para llamar la REST API de PayPal con el token de partner.
 * Incluye el BN Code (attribution) si está configurado.
 */
export async function paypalHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const token = await getPartnerAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
  const bn = getPayPalBnCode();
  if (bn) headers["PayPal-Partner-Attribution-Id"] = bn;
  return headers;
}
