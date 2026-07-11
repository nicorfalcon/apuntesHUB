/**
 * Comisión de la plataforma, por tipo de venta. Es SOLO para mostrar: el monto real que se
 * cobra lo calculan las RPCs de la base (purchase_resume, purchase_order, enroll_course,
 * create_tutoring_booking) y la app siempre lee el platform_fee ya calculado.
 *
 * Si cambia un porcentaje en la base, hay que actualizarlo acá también.
 */
export const PLATFORM_FEE_PERCENT = {
  /** Apuntes sueltos, paquetes y carrito. */
  resume: 10,
  /** Cursos grabados. */
  course: 10,
  /** Clases particulares. */
  tutoring: 2.5,
} as const;

/** Lo que le queda al vendedor, en porcentaje. */
export function sellerSharePercent(kind: keyof typeof PLATFORM_FEE_PERCENT) {
  return 100 - PLATFORM_FEE_PERCENT[kind];
}

/** Formatea un porcentaje con coma decimal: 2.5 → "2,5". */
export function formatPercent(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
