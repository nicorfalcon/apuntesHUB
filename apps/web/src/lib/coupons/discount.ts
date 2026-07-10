// Helpers puros de cupones para la UI. El cálculo autoritativo vive en la DB
// (compute_coupon_discount / validate_coupon); esto es para mostrar montos y
// validar el formulario del vendedor del lado del cliente.

export type DiscountType = "percentage" | "fixed";

export interface CouponInput {
  discountType: DiscountType;
  value: number;
}

/**
 * Importe a descontar dado un precio y el cupón, clampeado para no superar el precio
 * ni ser negativo. Debe coincidir con compute_coupon_discount (SQL).
 */
export function computeDiscount(price: number, coupon: CouponInput): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const raw =
    coupon.discountType === "percentage"
      ? round2((price * coupon.value) / 100)
      : round2(coupon.value);
  return Math.max(0, Math.min(price, raw));
}

/** Precio final tras aplicar el cupón. */
export function finalPrice(price: number, coupon: CouponInput): number {
  return round2(price - computeDiscount(price, coupon));
}

/** Redondeo a 2 decimales (evita 0.1+0.2 y similares en la UI). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Normaliza un código a mayúsculas sin espacios (igual que la DB compara). */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Valida el formulario de creación de cupón del vendedor. Devuelve un mensaje de
 * error legible o null si es válido.
 */
export function validateCouponForm(input: {
  code: string;
  discountType: DiscountType;
  value: number;
  maxUses: number | null;
}): string | null {
  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    return "El código debe tener entre 3 y 20 caracteres (letras y números).";
  }
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return "El valor del descuento debe ser mayor a 0.";
  }
  if (input.discountType === "percentage" && input.value > 100) {
    return "El porcentaje no puede superar 100.";
  }
  if (input.maxUses !== null && (!Number.isInteger(input.maxUses) || input.maxUses <= 0)) {
    return "El límite de usos debe ser un número entero mayor a 0.";
  }
  return null;
}

/** Etiqueta legible del descuento (ej: "20% OFF" o "$500 OFF"). */
export function formatDiscountLabel(coupon: CouponInput): string {
  return coupon.discountType === "percentage"
    ? `${coupon.value}% OFF`
    : `$${coupon.value.toLocaleString("es-AR")} OFF`;
}
