export type PaymentKind = "purchase" | "course" | "tutoring";

export interface ParsedExternalReference {
  kind: PaymentKind;
  id: string;
}

const TUTORING_PREFIX = "tutoring_booking:";
const COURSE_PREFIX = "course_enrollment:";

/**
 * Determina el tipo de transacción y el id del recurso a partir del
 * external_reference de un pago de Mercado Pago.
 *
 *   "tutoring_booking:<uuid>"  -> reserva de clase particular
 *   "course_enrollment:<uuid>" -> inscripción a curso grabado
 *   "<uuid>"                   -> compra de apunte (sin prefijo)
 */
export function parseExternalReference(ref: string): ParsedExternalReference {
  if (ref.startsWith(TUTORING_PREFIX)) {
    return { kind: "tutoring", id: ref.slice(TUTORING_PREFIX.length) };
  }
  if (ref.startsWith(COURSE_PREFIX)) {
    return { kind: "course", id: ref.slice(COURSE_PREFIX.length) };
  }
  return { kind: "purchase", id: ref };
}
