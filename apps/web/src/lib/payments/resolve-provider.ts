import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentProvider = "mercadopago" | "paypal";

export interface SellerPayPalCreds {
  merchantId: string;
  currency: string;
  paymentsReceivable: boolean;
}

export interface ResolvedProvider {
  /** Proveedor a usar en el checkout, o null si el vendedor no tiene ninguno. */
  provider: PaymentProvider | null;
  /** Credenciales de PayPal del vendedor (si tiene). */
  paypal: SellerPayPalCreds | null;
}

/**
 * Decide con qué proveedor cobra un vendedor:
 *   - Solo uno conectado           → ese.
 *   - Ambos conectados             → profiles.preferred_payment_provider
 *                                    (default 'mercadopago' si nunca eligió).
 *   - Ninguno                      → null.
 *
 * Recibe un admin client (service_role) porque las tablas de credenciales tienen
 * RLS sin políticas.
 */
export async function resolveSellerProvider(
  admin: SupabaseClient,
  sellerId: string
): Promise<ResolvedProvider> {
  const [{ data: mp }, { data: pp }, { data: profile }] = await Promise.all([
    admin
      .from("seller_mp_credentials")
      .select("id")
      .eq("id", sellerId)
      .maybeSingle(),
    admin
      .from("seller_paypal_credentials")
      .select("paypal_merchant_id, payout_currency, payments_receivable")
      .eq("id", sellerId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("preferred_payment_provider")
      .eq("id", sellerId)
      .maybeSingle(),
  ]);

  const hasMp = Boolean(mp);
  const paypal: SellerPayPalCreds | null = pp
    ? {
        merchantId: pp.paypal_merchant_id,
        currency: pp.payout_currency,
        paymentsReceivable: pp.payments_receivable,
      }
    : null;

  let provider: PaymentProvider | null;
  if (hasMp && paypal) {
    const preferred = profile?.preferred_payment_provider as
      | PaymentProvider
      | null
      | undefined;
    provider = preferred === "paypal" ? "paypal" : "mercadopago";
  } else if (hasMp) {
    provider = "mercadopago";
  } else if (paypal) {
    provider = "paypal";
  } else {
    provider = null;
  }

  return { provider, paypal };
}

/**
 * ¿El vendedor puede recibir pagos por algún proveedor (MP o PayPal)?
 * Se usa en las páginas de producto para decidir si mostrar el botón de compra.
 * Requiere admin client (las tablas de credenciales tienen RLS sin políticas).
 */
export async function sellerAcceptsPayments(
  admin: SupabaseClient,
  sellerId: string
): Promise<boolean> {
  const [{ data: mp }, { data: pp }] = await Promise.all([
    admin.from("seller_mp_credentials").select("id").eq("id", sellerId).maybeSingle(),
    admin
      .from("seller_paypal_credentials")
      .select("id")
      .eq("id", sellerId)
      .maybeSingle(),
  ]);
  return Boolean(mp) || Boolean(pp);
}
