// Helpers puros para descuentos directos (sin código) sobre apuntes y cursos.
// El cálculo autoritativo del cobro vive en la DB (purchase_order / enroll_course);
// esto es para mostrar el precio final y el ahorro en la UI, y debe coincidir con el SQL:
//   precio_efectivo = round(price * (100 - discount_percent) / 100, 2)

/** Redondeo a 2 decimales, alineado con round(numeric, 2) de Postgres. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Normaliza el porcentaje al rango permitido (0–90 enteros). */
export function clampDiscountPercent(percent: number | null | undefined): number {
  if (!Number.isFinite(percent as number)) return 0;
  return Math.min(90, Math.max(0, Math.round(percent as number)));
}

/** ¿El ítem tiene un descuento directo activo? */
export function hasDiscount(discountPercent: number | null | undefined): boolean {
  return clampDiscountPercent(discountPercent) > 0;
}

/** Precio final tras aplicar el descuento directo. Si no hay descuento, el precio tal cual. */
export function discountedPrice(
  price: number,
  discountPercent: number | null | undefined
): number {
  const pct = clampDiscountPercent(discountPercent);
  if (pct === 0) return round2(price);
  return round2((price * (100 - pct)) / 100);
}

/** Ahorro absoluto respecto del precio de lista. */
export function discountSavings(
  price: number,
  discountPercent: number | null | undefined
): number {
  return round2(price - discountedPrice(price, discountPercent));
}

/** Etiqueta corta del descuento para badges (ej: "-20%"). */
export function formatDiscountBadge(discountPercent: number | null | undefined): string {
  return `-${clampDiscountPercent(discountPercent)}%`;
}
