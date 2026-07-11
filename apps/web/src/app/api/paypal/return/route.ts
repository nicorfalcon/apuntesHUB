import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { capturePayPalOrder } from "@/lib/paypal/capture-order";
import { applyPaymentAction } from "@/lib/payments/apply-payment";
import { checkoutPathFor } from "@/lib/paypal/checkout-paths";

/**
 * GET /api/paypal/return
 * PayPal redirige acá cuando el comprador aprueba (o cancela) el pago.
 * Query: token = orderId de PayPal, PayerID.
 *
 * Captura la orden con el merchant del vendedor y aplica el fulfillment. El webhook
 * también confirma la venta; ambos son idempotentes.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const orderId = request.nextUrl.searchParams.get("token");

  if (!orderId) {
    return NextResponse.redirect(new URL("/carrito?paypal=error", appUrl));
  }

  const admin = createAdminClient();

  // Ubicar el registro por paypal_order_id para conocer al vendedor (necesario para capturar).
  const sellerId = await findSellerByOrderId(admin, orderId);
  if (!sellerId) {
    console.error(`No se encontró registro para la orden PayPal ${orderId}`);
    return NextResponse.redirect(new URL("/carrito?paypal=error", appUrl));
  }

  const { data: creds } = await admin
    .from("seller_paypal_credentials")
    .select("paypal_merchant_id")
    .eq("id", sellerId)
    .maybeSingle();

  if (!creds) {
    return NextResponse.redirect(new URL("/carrito?paypal=error", appUrl));
  }

  try {
    const result = await capturePayPalOrder(orderId, creds.paypal_merchant_id);

    if (!result.customId) {
      console.error(`Captura de ${orderId} sin custom_id`);
      return NextResponse.redirect(new URL("/carrito?paypal=error", appUrl));
    }

    // Mapear estado de la captura a nuestro vocabulario normalizado.
    const status =
      result.captureStatus === "COMPLETED"
        ? "approved"
        : result.captureStatus === "DECLINED"
          ? "rejected"
          : "pending";

    // Usamos el id de la captura como payment_id (fallback: orderId).
    const paymentId = result.captureId ?? orderId;

    await applyPaymentAction({
      admin,
      externalReference: result.customId,
      paymentId,
      status,
    });

    const outcome =
      status === "approved"
        ? "success"
        : status === "rejected"
          ? "failure"
          : "pending";

    return NextResponse.redirect(
      new URL(checkoutPathFor(result.customId, outcome), appUrl)
    );
  } catch (err) {
    console.error("Error al capturar la orden de PayPal:", err);
    return NextResponse.redirect(new URL("/carrito?paypal=error", appUrl));
  }
}

/**
 * Busca en las 4 tablas de pago cuál tiene este paypal_order_id y devuelve el id del
 * vendedor asociado (seller/author/tutor).
 */
async function findSellerByOrderId(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string
): Promise<string | null> {
  const [purchase, order, enrollment, booking] = await Promise.all([
    admin.from("purchases").select("seller_id").eq("paypal_order_id", orderId).maybeSingle(),
    admin.from("orders").select("seller_id").eq("paypal_order_id", orderId).maybeSingle(),
    admin
      .from("course_enrollments")
      .select("recorded_courses!inner(author_id)")
      .eq("paypal_order_id", orderId)
      .maybeSingle(),
    admin.from("tutor_bookings").select("tutor_id").eq("paypal_order_id", orderId).maybeSingle(),
  ]);

  if (purchase.data?.seller_id) return purchase.data.seller_id;
  if (order.data?.seller_id) return order.data.seller_id;
  if (enrollment.data) {
    const course = (enrollment.data as Record<string, unknown>)
      .recorded_courses as { author_id: string } | null;
    if (course?.author_id) return course.author_id;
  }
  if (booking.data?.tutor_id) return booking.data.tutor_id;
  return null;
}
