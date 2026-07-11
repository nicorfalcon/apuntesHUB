import { getPayPalApiBase, getPartnerClientId } from "./config";
import { paypalHeaders } from "./client";

/**
 * Genera un Partner Referral para onboardear a un vendedor en PayPal.
 * Devuelve la URL de acción a la que redirigimos al vendedor para que conecte su
 * cuenta PayPal Business y nos otorgue permisos (incluido PARTNER_FEE para el split).
 *
 * Ref: https://developer.paypal.com/docs/multiparty/seller-onboarding/
 */
export interface PartnerReferral {
  actionUrl: string;
  /** tracking_id que enviamos: lo usamos para correlacionar el callback/webhook. */
  trackingId: string;
}

export async function createPartnerReferral(params: {
  sellerId: string;
  returnUrl: string;
}): Promise<PartnerReferral> {
  const { sellerId, returnUrl } = params;
  // Usamos el id del vendedor como tracking_id para correlacionar el onboarding.
  const trackingId = sellerId;

  const body = {
    tracking_id: trackingId,
    partner_config_override: {
      return_url: returnUrl,
      return_url_description:
        "Volvé a apuntesHUB para terminar de configurar tus cobros.",
    },
    operations: [
      {
        operation: "API_INTEGRATION",
        api_integration_preference: {
          rest_api_integration: {
            integration_method: "PAYPAL",
            integration_type: "THIRD_PARTY",
            third_party_details: {
              features: [
                "PAYMENT",
                "REFUND",
                "PARTNER_FEE",
                "DELAY_FUNDS_DISBURSEMENT",
              ],
            },
          },
        },
      },
    ],
    products: ["EXPRESS_CHECKOUT"],
    legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
    // Requerido por PayPal para identificar a la plataforma partner.
    partner_client_id: getPartnerClientId(),
  };

  const headers = await paypalHeaders();

  const res = await fetch(
    `${getPayPalApiBase()}/v2/customer/partner-referrals`,
    { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Error al crear el Partner Referral de PayPal: ${res.status} - ${detail}`
    );
  }

  const data = (await res.json()) as {
    links?: Array<{ rel: string; href: string }>;
  };

  const action = data.links?.find((l) => l.rel === "action_url");
  if (!action) {
    throw new Error("El Partner Referral no devolvió action_url");
  }

  return { actionUrl: action.href, trackingId };
}

/**
 * Consulta el estado del merchant tras el onboarding, usando el tracking_id.
 * Devuelve el merchant_id de PayPal y si ya puede recibir pagos.
 *
 * Requiere PAYPAL_PARTNER_MERCHANT_ID (el merchant id de la plataforma partner).
 */
export interface MerchantOnboardingStatus {
  merchantId: string | null;
  paymentsReceivable: boolean;
  primaryEmailConfirmed: boolean;
}

export async function getMerchantOnboardingStatus(
  trackingId: string
): Promise<MerchantOnboardingStatus> {
  const { getPartnerMerchantId } = await import("./config");
  const partnerMerchantId = getPartnerMerchantId();
  const headers = await paypalHeaders();

  const res = await fetch(
    `${getPayPalApiBase()}/v1/customer/partners/${partnerMerchantId}/merchant-integrations?tracking_id=${encodeURIComponent(trackingId)}`,
    { method: "GET", headers, cache: "no-store" }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Error al consultar el estado del merchant: ${res.status} - ${detail}`
    );
  }

  const data = (await res.json()) as {
    merchant_id?: string;
    payments_receivable?: boolean;
    primary_email_confirmed?: boolean;
  };

  return {
    merchantId: data.merchant_id ?? null,
    paymentsReceivable: Boolean(data.payments_receivable),
    primaryEmailConfirmed: Boolean(data.primary_email_confirmed),
  };
}
