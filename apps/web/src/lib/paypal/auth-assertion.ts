import { getPartnerClientId } from "./config";

/**
 * Construye el header `PayPal-Auth-Assertion`, que le indica a PayPal en nombre de qué
 * vendedor (merchant) actúa la plataforma al crear/capturar una orden con split.
 *
 * Es un JWT SIN firmar (alg: none): header.payload. (tercer segmento vacío). PayPal lo
 * valida contra el contexto OAuth del partner, no contra una firma.
 *   header  = { "alg": "none" }
 *   payload = { "iss": <partner_client_id>, "payer_id": <seller_merchant_id> }
 *
 * Ref: https://developer.paypal.com/docs/multiparty/checkout/standard/integrate/
 */
function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildAuthAssertion(sellerMerchantId: string): string {
  const header = base64url(JSON.stringify({ alg: "none" }));
  const payload = base64url(
    JSON.stringify({
      iss: getPartnerClientId(),
      payer_id: sellerMerchantId,
    })
  );
  return `${header}.${payload}.`;
}
