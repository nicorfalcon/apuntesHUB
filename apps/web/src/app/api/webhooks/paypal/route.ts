import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayPalWebhook } from "@/lib/paypal/webhook-verify";
import { applyPaymentAction } from "@/lib/payments/apply-payment";

/**
 * POST /api/webhooks/paypal
 * Recibe notificaciones de PayPal. Verifica la firma y:
 *   - PAYMENT.CAPTURE.COMPLETED  → confirma la venta (fulfillment)
 *   - PAYMENT.CAPTURE.DENIED/REVERSED → marca el pago como fallido
 *   - MERCHANT.ONBOARDING.COMPLETED / MERCHANT.PARTNER-CONSENT.* → estado de la cuenta del vendedor
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const valid = await verifyPayPalWebhook({ headers: request.headers, rawBody });
  if (!valid) {
    console.error("Webhook de PayPal con firma inválida");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        await handleCapture(admin, event, "approved");
        break;
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED":
      case "PAYMENT.CAPTURE.REFUNDED":
        await handleCapture(admin, event, "rejected");
        break;
      case "MERCHANT.ONBOARDING.COMPLETED":
      case "MERCHANT.PARTNER-CONSENT.REVOKED":
        await handleMerchantEvent(admin, event);
        break;
      default:
        // Otros eventos: ack sin procesar.
        break;
    }
  } catch (err) {
    console.error("Error procesando webhook de PayPal:", err);
    // 200 igual: PayPal reintenta ante 5xx; para errores de lógica evitamos loops.
  }

  return NextResponse.json({ received: true });
}

async function handleCapture(
  admin: ReturnType<typeof createAdminClient>,
  event: PayPalWebhookEvent,
  status: "approved" | "rejected"
) {
  const resource = event.resource ?? {};
  const customId = resource.custom_id;
  const captureId = resource.id;

  if (!customId || !captureId) {
    console.error("Captura de PayPal sin custom_id o id:", event.id);
    return;
  }

  await applyPaymentAction({
    admin,
    externalReference: customId,
    paymentId: captureId,
    status,
  });
}

async function handleMerchantEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: PayPalWebhookEvent
) {
  const resource = event.resource ?? {};
  const merchantId = resource.merchant_id;
  const trackingId = resource.tracking_id;

  if (!merchantId && !trackingId) return;

  const receivable = event.event_type === "MERCHANT.ONBOARDING.COMPLETED";

  let query = admin.from("seller_paypal_credentials").update({
    payments_receivable: receivable,
  });

  // Preferimos correlacionar por tracking_id (= id del vendedor); si no, por merchant_id.
  query = trackingId
    ? query.eq("id", trackingId)
    : query.eq("paypal_merchant_id", merchantId!);

  const { error } = await query;
  if (error) console.error("Error actualizando estado del merchant PayPal:", error);
}

interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    merchant_id?: string;
    tracking_id?: string;
  };
}
