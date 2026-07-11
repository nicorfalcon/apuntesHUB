/**
 * Monedas de payout que el vendedor puede elegir para cobrar con PayPal.
 * Subconjunto de las monedas soportadas por PayPal, relevante para la audiencia.
 * Ref: https://developer.paypal.com/api/rest/reference/currency-codes/
 *
 * IMPORTANTE: ARS no está: PayPal no procesa pesos argentinos. Los vendedores de
 * Argentina cobran con Mercado Pago; PayPal es para vendedores del exterior.
 */
export const PAYPAL_CURRENCIES = [
  { code: "USD", label: "Dólar estadounidense (USD)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "BRL", label: "Real brasileño (BRL)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "UYU", label: "Peso uruguayo (UYU)" },
  { code: "CAD", label: "Dólar canadiense (CAD)" },
] as const;

export type PayPalCurrency = (typeof PAYPAL_CURRENCIES)[number]["code"];

const CURRENCY_CODES = new Set(PAYPAL_CURRENCIES.map((c) => c.code));

export const DEFAULT_PAYPAL_CURRENCY: PayPalCurrency = "USD";

export function isSupportedCurrency(code: string): code is PayPalCurrency {
  return CURRENCY_CODES.has(code as PayPalCurrency);
}

/**
 * Monedas que PayPal NO acepta con decimales (JPY, HUF, TWD…). Ninguna de nuestra lista
 * lo requiere hoy, pero dejamos el helper para formatear montos correctamente.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "HUF", "TWD", "CLP"]);

/** Formatea un monto numérico al string que espera la API de PayPal para esa moneda. */
export function formatPayPalAmount(amount: number, currency: string): string {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    return String(Math.round(amount));
  }
  return amount.toFixed(2);
}
