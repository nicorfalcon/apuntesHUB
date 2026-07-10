import type { PaymentKind } from "./external-reference";

export interface PaymentAction {
  rpc: string;
  idArg: string;
  shouldNotify: boolean;
}

const RPC_BY_KIND: Record<
  PaymentKind,
  { complete: string; fail: string; idArg: string }
> = {
  purchase: {
    complete: "complete_purchase",
    fail: "fail_purchase",
    idArg: "p_purchase_id",
  },
  course: {
    complete: "complete_course_enrollment",
    fail: "fail_course_enrollment",
    idArg: "p_enrollment_id",
  },
  tutoring: {
    complete: "complete_tutoring_booking",
    fail: "fail_tutoring_booking",
    idArg: "p_booking_id",
  },
  order: {
    complete: "complete_order",
    fail: "fail_order",
    idArg: "p_order_id",
  },
};

/**
 * Mapea el estado de un pago de MP a la acción de DB que corresponde, según el
 * tipo de transacción:
 *   - approved             -> RPC de completar (+ notificar por email)
 *   - rejected / cancelled -> RPC de fallar (sin notificar)
 *   - cualquier otro       -> null (pending/in_process: esperar otra notificación)
 */
export function resolvePaymentAction(
  paymentStatus: string,
  kind: PaymentKind
): PaymentAction | null {
  const rpcs = RPC_BY_KIND[kind];

  if (paymentStatus === "approved") {
    return { rpc: rpcs.complete, idArg: rpcs.idArg, shouldNotify: true };
  }
  if (paymentStatus === "rejected" || paymentStatus === "cancelled") {
    return { rpc: rpcs.fail, idArg: rpcs.idArg, shouldNotify: false };
  }
  return null;
}
