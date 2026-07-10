// Helpers puros para paquetes (bundles). Cálculos de UI: el precio del pack lo fija
// el vendedor; acá derivamos la suma de precios sueltos y el ahorro para mostrarlos.

/** Suma de los precios de una lista de apuntes (precio "si se compran por separado"). */
export function sumResumePrices(prices: number[]): number {
  return round2(
    prices.reduce((acc, p) => acc + (Number.isFinite(p) && p > 0 ? p : 0), 0)
  );
}

/** Ahorro absoluto del pack respecto de comprar los apuntes por separado. */
export function bundleSavings(bundlePrice: number, individualTotal: number): number {
  return Math.max(0, round2(individualTotal - bundlePrice));
}

/** Ahorro en porcentaje (0–100). 0 si no hay base de comparación. */
export function bundleSavingsPercent(
  bundlePrice: number,
  individualTotal: number
): number {
  if (!Number.isFinite(individualTotal) || individualTotal <= 0) return 0;
  const pct = (bundleSavings(bundlePrice, individualTotal) / individualTotal) * 100;
  return Math.round(pct);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Valida el formulario de creación/edición de un paquete. Devuelve un mensaje de
 * error legible o null si es válido.
 */
export function validateBundleForm(input: {
  title: string;
  price: number;
  resumeIds: string[];
}): string | null {
  if (!input.title.trim()) {
    return "Poné un título para el paquete.";
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return "El precio debe ser 0 o mayor.";
  }
  if (input.resumeIds.length < 2) {
    return "Un paquete debe incluir al menos 2 apuntes.";
  }
  return null;
}
