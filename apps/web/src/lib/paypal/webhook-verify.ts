import { getPayPalApiBase, getPayPalWebhookId } from "./config";
import { paypalHeaders } from "./client";

/**
 * Verifica la firma de un webhook de PayPal usando la API oficial
 * /v1/notifications/verify-webhook-signature. Es el equivalente al HMAC de Mercado Pago.
 *
 * Los headers necesarios vienen en la request entrante:
 *   paypal-transmission-id, paypal-transmission-time, paypal-cert-url,
 *   paypal-auth-algo, paypal-transmission-sig
 */
export async function verifyPayPalWebhook(params: {
  headers: Headers;
  rawBody: string;
}): Promise<boolean> {
  const { headers, rawBody } = params;

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  // El webhook_event debe enviarse como objeto, no como string re-serializado,
  // para que PayPal reconstruya la firma exactamente.
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const body = {
    transmission_id: transmissionId,
    transmission_time: transmissionTime,
    cert_url: certUrl,
    auth_algo: authAlgo,
    transmission_sig: transmissionSig,
    webhook_id: getPayPalWebhookId(),
    webhook_event: event,
  };

  const res = await fetch(
    `${getPayPalApiBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: await paypalHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!res.ok) return false;

  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
