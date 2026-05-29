import { describe, it, expect } from "vitest";
import { resolvePaymentAction } from "../payment-action";
import type { PaymentKind } from "../external-reference";

describe("resolvePaymentAction", () => {
  describe("pago aprobado", () => {
    it.each([
      ["purchase", "complete_purchase", "p_purchase_id"],
      ["course", "complete_course_enrollment", "p_enrollment_id"],
      ["tutoring", "complete_tutoring_booking", "p_booking_id"],
    ] as [PaymentKind, string, string][])(
      "para %s usa el RPC de completar y marca shouldNotify",
      (kind, rpc, idArg) => {
        // when
        const action = resolvePaymentAction("approved", kind);

        // then
        expect(action).toEqual({ rpc, idArg, shouldNotify: true });
      }
    );
  });

  describe("pago rechazado o cancelado", () => {
    it.each([
      ["purchase", "fail_purchase", "p_purchase_id"],
      ["course", "fail_course_enrollment", "p_enrollment_id"],
      ["tutoring", "fail_tutoring_booking", "p_booking_id"],
    ] as [PaymentKind, string, string][])(
      "para %s usa el RPC de fallar y no notifica",
      (kind, rpc, idArg) => {
        expect(resolvePaymentAction("rejected", kind)).toEqual({
          rpc,
          idArg,
          shouldNotify: false,
        });
        expect(resolvePaymentAction("cancelled", kind)).toEqual({
          rpc,
          idArg,
          shouldNotify: false,
        });
      }
    );
  });

  describe("estados intermedios", () => {
    it.each(["pending", "in_process", "authorized", ""])(
      "devuelve null para el estado '%s' (esperar otra notificación)",
      (status) => {
        expect(resolvePaymentAction(status, "purchase")).toBeNull();
      }
    );
  });
});
