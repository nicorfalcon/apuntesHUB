import {
  parseExternalReference,
  type PaymentKind,
} from "@/lib/mercadopago/external-reference";

type Outcome = "success" | "failure" | "pending";

/**
 * Mapea una referencia interna (custom_id) + resultado al path de checkout que
 * corresponde, reutilizando las mismas páginas que Mercado Pago.
 */
export function checkoutPathFor(externalReference: string, outcome: Outcome): string {
  const { kind, id } = parseExternalReference(externalReference);

  const config: Record<PaymentKind, { base: string; param: string }> = {
    purchase: { base: "/checkout", param: "purchase_id" },
    order: { base: "/checkout/order", param: "order_id" },
    course: { base: "/checkout/curso", param: "enrollment_id" },
    tutoring: { base: "/checkout/clase", param: "booking_id" },
  };

  const { base, param } = config[kind];
  return `${base}/${outcome}?${param}=${id}`;
}
