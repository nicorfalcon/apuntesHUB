/**
 * Configuración de PayPal Commerce Platform (Multiparty).
 *
 * Todas las llamadas usan las credenciales de PARTNER (nuestra plataforma). El cobro
 * a cada vendedor se hace con el header PayPal-Auth-Assertion + su merchant_id, sin
 * almacenar tokens por vendedor.
 *
 * Variables de entorno requeridas:
 *   PAYPAL_ENV=sandbox|live
 *   PAYPAL_PARTNER_CLIENT_ID
 *   PAYPAL_PARTNER_CLIENT_SECRET
 *   PAYPAL_PARTNER_MERCHANT_ID   (payer/merchant id de la plataforma; payee del platform_fee)
 *   PAYPAL_BN_CODE               (attribution id de partner)
 *   PAYPAL_WEBHOOK_ID            (para verificar la firma de los webhooks)
 */

export type PayPalEnv = "sandbox" | "live";

export function getPayPalEnv(): PayPalEnv {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

/** Base URL de la REST API según el entorno. */
export function getPayPalApiBase(): string {
  return getPayPalEnv() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function getPartnerClientId(): string {
  const v = process.env.PAYPAL_PARTNER_CLIENT_ID;
  if (!v) throw new Error("PAYPAL_PARTNER_CLIENT_ID no configurado");
  return v;
}

export function getPartnerClientSecret(): string {
  const v = process.env.PAYPAL_PARTNER_CLIENT_SECRET;
  if (!v) throw new Error("PAYPAL_PARTNER_CLIENT_SECRET no configurado");
  return v;
}

export function getPartnerMerchantId(): string {
  const v = process.env.PAYPAL_PARTNER_MERCHANT_ID;
  if (!v) throw new Error("PAYPAL_PARTNER_MERCHANT_ID no configurado");
  return v;
}

/** BN Code (attribution id). Opcional pero recomendado por PayPal para partners. */
export function getPayPalBnCode(): string | null {
  return process.env.PAYPAL_BN_CODE ?? null;
}

export function getPayPalWebhookId(): string {
  const v = process.env.PAYPAL_WEBHOOK_ID;
  if (!v) throw new Error("PAYPAL_WEBHOOK_ID no configurado");
  return v;
}
