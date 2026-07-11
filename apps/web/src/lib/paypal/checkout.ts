import { createPayPalOrder, type PayPalOrderItem } from "./create-order";
import type { SellerPayPalCreds } from "@/lib/payments/resolve-provider";

/**
 * Envuelve createPayPalOrder para los checkouts: arma las URLs de retorno/cancelación
 * a partir de NEXT_PUBLIC_APP_URL y usa la moneda de payout del vendedor.
 *
 * Devuelve { orderId, redirectUrl } — el caller guarda orderId como paypal_order_id
 * en su tabla y devuelve redirectUrl al cliente.
 */
export async function startPayPalCheckout(params: {
  paypal: SellerPayPalCreds;
  items: PayPalOrderItem[];
  /** Referencia interna (mismo formato que external_reference de MP). */
  customId: string;
  platformFee: number;
  description?: string;
  /** Path al que volver si el comprador cancela (ej. la página del producto). */
  cancelPath?: string;
}): Promise<{ orderId: string; redirectUrl: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const { paypal, items, customId, platformFee, description, cancelPath } = params;

  const { orderId, approveUrl } = await createPayPalOrder({
    sellerMerchantId: paypal.merchantId,
    currency: paypal.currency,
    items,
    customId,
    platformFee,
    description,
    returnUrl: `${appUrl}/api/paypal/return`,
    cancelUrl: `${appUrl}${cancelPath ?? "/carrito"}`,
  });

  return { orderId, redirectUrl: approveUrl };
}
