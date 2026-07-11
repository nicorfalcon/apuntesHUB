import { getPayPalApiBase, getPartnerMerchantId } from "./config";
import { paypalHeaders } from "./client";
import { buildAuthAssertion } from "./auth-assertion";
import { formatPayPalAmount } from "./currencies";

export interface PayPalOrderItem {
  /** Nombre visible del ítem (máx 127 chars, PayPal trunca). */
  name: string;
  /** Precio unitario en la moneda del vendedor. */
  amount: number;
}

export interface CreatePayPalOrderParams {
  /** merchant_id del vendedor (payee que recibe el pago). */
  sellerMerchantId: string;
  /** Moneda del cobro (la de payout del vendedor). */
  currency: string;
  items: PayPalOrderItem[];
  /** Referencia interna (equivalente al external_reference de MP). Va en custom_id. */
  customId: string;
  /** Comisión de la plataforma, en la misma moneda que el cobro. */
  platformFee: number;
  /** URL a la que PayPal redirige tras aprobar / cancelar. */
  returnUrl: string;
  cancelUrl: string;
  /** Descripción corta de la compra (opcional). */
  description?: string;
}

export interface CreatedPayPalOrder {
  orderId: string;
  /** Link al que hay que redirigir al comprador para aprobar el pago. */
  approveUrl: string;
}

/**
 * Crea una Order v2 de PayPal con split de comisión (Commerce Platform / Multiparty).
 *
 * - `purchase_units[].payee.merchant_id` → el vendedor cobra.
 * - `purchase_units[].payment_instruction.platform_fees[]` → la plataforma retiene su comisión.
 * - Header `PayPal-Auth-Assertion` → la plataforma actúa en nombre del vendedor.
 *
 * Requiere que el vendedor haya sido onboardeado con la feature PARTNER_FEE.
 */
export async function createPayPalOrder(
  params: CreatePayPalOrderParams
): Promise<CreatedPayPalOrder> {
  const {
    sellerMerchantId,
    currency,
    items,
    customId,
    platformFee,
    returnUrl,
    cancelUrl,
    description,
  } = params;

  const itemTotal = items.reduce((sum, it) => sum + it.amount, 0);
  const totalStr = formatPayPalAmount(itemTotal, currency);

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: customId,
        description: description?.slice(0, 127),
        amount: {
          currency_code: currency,
          value: totalStr,
          breakdown: {
            item_total: { currency_code: currency, value: totalStr },
          },
        },
        items: items.map((it) => ({
          name: it.name.slice(0, 127),
          quantity: "1",
          unit_amount: {
            currency_code: currency,
            value: formatPayPalAmount(it.amount, currency),
          },
        })),
        payee: { merchant_id: sellerMerchantId },
        payment_instruction: {
          disbursement_mode: "INSTANT",
          platform_fees: [
            {
              amount: {
                currency_code: currency,
                value: formatPayPalAmount(platformFee, currency),
              },
              payee: { merchant_id: getPartnerMerchantId() },
            },
          ],
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };

  const headers = await paypalHeaders({
    "PayPal-Auth-Assertion": buildAuthAssertion(sellerMerchantId),
  });

  const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Error al crear la orden de PayPal: ${res.status} - ${detail}`);
  }

  const data = (await res.json()) as {
    id: string;
    links?: Array<{ rel: string; href: string }>;
  };

  const approve = data.links?.find(
    (l) => l.rel === "payer-action" || l.rel === "approve"
  );

  if (!approve) {
    throw new Error("La orden de PayPal no devolvió un link de aprobación");
  }

  return { orderId: data.id, approveUrl: approve.href };
}
