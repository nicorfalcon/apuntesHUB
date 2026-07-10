export type PaymentKind = "purchase" | "course" | "tutoring" | "order";

export interface ParsedExternalReference {
  kind: PaymentKind;
  id: string;
}

const TUTORING_PREFIX = "tutoring_booking:";
const COURSE_PREFIX = "course_enrollment:";
const ORDER_PREFIX = "order:";

/**
 * Determina el tipo de transacción y el id del recurso a partir del
 * external_reference de un pago de Mercado Pago.
 *
 *   "tutoring_booking:<uuid>"  -> reserva de clase particular
 *   "course_enrollment:<uuid>" -> inscripción a curso grabado
 *   "order:<uuid>"             -> orden (bundle o grupo de carrito, 1+ ítems)
 *   "<uuid>"                   -> compra de apunte suelto (sin prefijo)
 */
export function parseExternalReference(ref: string): ParsedExternalReference {
  if (ref.startsWith(TUTORING_PREFIX)) {
    return { kind: "tutoring", id: ref.slice(TUTORING_PREFIX.length) };
  }
  if (ref.startsWith(COURSE_PREFIX)) {
    return { kind: "course", id: ref.slice(COURSE_PREFIX.length) };
  }
  if (ref.startsWith(ORDER_PREFIX)) {
    return { kind: "order", id: ref.slice(ORDER_PREFIX.length) };
  }
  return { kind: "purchase", id: ref };
}
