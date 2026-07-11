import type { SupabaseClient } from "@supabase/supabase-js";
import { parseExternalReference } from "@/lib/mercadopago/external-reference";
import { resolvePaymentAction } from "@/lib/mercadopago/payment-action";
import {
  sendCourseSaleNotification,
  sendResumeSaleNotification,
} from "@/lib/email/sale-notifications";

/**
 * Estado normalizado del pago, en el vocabulario que entiende resolvePaymentAction
 * (heredado de Mercado Pago). Cada proveedor mapea su propio estado a este antes de llamar.
 */
export type NormalizedPaymentStatus = "approved" | "rejected" | "cancelled";

export interface ApplyPaymentInput {
  admin: SupabaseClient;
  /** Referencia interna: mismo formato que el external_reference de MP (custom_id en PayPal). */
  externalReference: string;
  /** id del pago del proveedor (payment_id de MP / capture id de PayPal). */
  paymentId: string;
  /**
   * Estado del pago. Idealmente uno de NormalizedPaymentStatus, pero se acepta string
   * porque MP puede enviar estados intermedios (pending/in_process) que se filtran abajo.
   */
  status: NormalizedPaymentStatus | string;
}

/**
 * Aplica el efecto de un pago sobre la compra/inscripción/reserva/orden correspondiente.
 * Lógica AGNÓSTICA del proveedor: la comparten el webhook de Mercado Pago y el de PayPal.
 *
 * Determina el tipo de transacción desde la referencia, mapea el estado a la RPC de
 * completar/fallar, y dispara los emails de venta cuando corresponde. Las RPCs son
 * idempotentes (solo transicionan desde pending), así que reintentos son seguros.
 */
export async function applyPaymentAction(input: ApplyPaymentInput): Promise<void> {
  const { admin, externalReference, paymentId, status } = input;

  const { kind, id: targetId } = parseExternalReference(externalReference);

  const action = resolvePaymentAction(status, kind);
  if (!action) return; // estado intermedio: esperar otra notificación

  const rpcArgs = { [action.idArg]: targetId, p_payment_id: paymentId };

  if (kind === "tutoring") {
    if (action.shouldNotify) {
      const { data: didConfirm, error } = await admin.rpc(action.rpc, rpcArgs);
      if (error) {
        console.error("Error confirmando reserva:", error);
      } else if (didConfirm === true) {
        try {
          const { sendTutoringBookingNotifications } = await import(
            "@/lib/email/sale-notifications"
          );
          await sendTutoringBookingNotifications(admin, targetId, paymentId);
        } catch (emailError) {
          console.error("No se pudo enviar emails de tutoring:", emailError);
        }
      }
    } else {
      await admin.rpc(action.rpc, rpcArgs);
    }
    return;
  }

  // purchases, course_enrollments u orders (bundle / grupo de carrito)
  await admin.rpc(action.rpc, rpcArgs);

  if (action.shouldNotify && kind !== "order") {
    try {
      if (kind === "course") {
        await sendCourseSaleNotification(admin, targetId, paymentId);
      } else {
        await sendResumeSaleNotification(admin, targetId, paymentId);
      }
    } catch (emailError) {
      console.error("No se pudo enviar email de venta:", emailError);
    }
  }
}
