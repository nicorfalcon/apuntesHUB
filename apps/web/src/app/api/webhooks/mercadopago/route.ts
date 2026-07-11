import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";
import { validateSignature } from "@/lib/mercadopago/webhook-signature";
import { applyPaymentAction } from "@/lib/payments/apply-payment";

/**
 * POST /api/webhooks/mercadopago
 * Recibe notificaciones de pago de Mercado Pago.
 * Valida la firma HMAC-SHA256, consulta el pago, y actualiza el estado de la compra.
 */
export async function POST(request: NextRequest) {
  // 1. Validar firma HMAC-SHA256
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const dataId = request.nextUrl.searchParams.get("data.id");

  if (!xSignature || !xRequestId) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  const signatureValid = validateSignature(xSignature, xRequestId, dataId);
  if (!signatureValid) {
    console.error("Webhook HMAC validation failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parsear el body
  let body: { type?: string; action?: string; data?: { id?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Solo procesar notificaciones de pago
  if (body.type !== "payment" || !body.data?.id) {
    return NextResponse.json({ received: true });
  }

  const paymentId = body.data.id;

  try {
    await processPaymentNotification(paymentId);
  } catch (err) {
    console.error("Error procesando notificación de pago:", err);
    // Retornamos 200 igualmente para que MP no reintente indefinidamente
    // si es un error de lógica (ej: compra no encontrada)
  }

  return NextResponse.json({ received: true });
}

/**
 * Consulta el pago en la API de MP y actualiza la compra/inscripción/booking según el estado.
 * Soporta tres tipos de external_reference:
 *   - "<uuid>" → compra de apunte (purchases)
 *   - "course_enrollment:<uuid>" → inscripción a curso grabado (course_enrollments)
 *   - "tutoring_booking:<uuid>" → reserva de clase particular (tutor_bookings)
 */
async function processPaymentNotification(paymentId: string) {
  const admin = createAdminClient();

  // Idempotencia: si ya fue procesado en cualquiera de las tablas, salir.
  const [
    { data: existingPurchase },
    { data: existingEnrollment },
    { data: existingBooking },
    { data: existingOrder },
  ] = await Promise.all([
    admin.from("purchases").select("id, status").eq("payment_id", paymentId).maybeSingle(),
    admin
      .from("course_enrollments")
      .select("id, status")
      .eq("payment_id", paymentId)
      .maybeSingle(),
    admin
      .from("tutor_bookings")
      .select("id, status")
      .eq("payment_id", paymentId)
      .maybeSingle(),
    admin.from("orders").select("id, status").eq("payment_id", paymentId).maybeSingle(),
  ]);

  if (
    existingPurchase?.status === "completed" ||
    existingEnrollment?.status === "completed" ||
    existingBooking?.status === "confirmed" ||
    existingOrder?.status === "completed"
  ) {
    return;
  }

  // Buscar vendedores/tutores con pagos pendientes en las tres tablas
  // para probar consultando el pago con sus access_tokens.
  const [
    { data: pendingPurchases },
    { data: pendingEnrollments },
    { data: pendingBookings },
    { data: pendingOrders },
  ] = await Promise.all([
    admin
      .from("purchases")
      .select("seller_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("course_enrollments")
      .select("course_id, recorded_courses!inner(author_id)")
      .eq("status", "pending")
      .order("purchased_at", { ascending: false })
      .limit(50),
    admin
      .from("tutor_bookings")
      .select("tutor_id")
      .eq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("orders")
      .select("seller_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const sellerIdsFromPurchases = (pendingPurchases ?? []).map((p) => p.seller_id);
  const sellerIdsFromEnrollments = (pendingEnrollments ?? []).map((row) => {
    const course = (row as Record<string, unknown>).recorded_courses as
      | { author_id: string }
      | null;
    return course?.author_id;
  }).filter((id): id is string => Boolean(id));
  const sellerIdsFromBookings = (pendingBookings ?? []).map((b) => b.tutor_id);
  const sellerIdsFromOrders = (pendingOrders ?? []).map((o) => o.seller_id);

  const sellerIds = Array.from(
    new Set([
      ...sellerIdsFromPurchases,
      ...sellerIdsFromEnrollments,
      ...sellerIdsFromBookings,
      ...sellerIdsFromOrders,
    ])
  );

  if (sellerIds.length === 0) return;

  let paymentData: {
    status: string;
    external_reference: string;
    transaction_amount: number;
  } | null = null;

  // Intentar obtener el pago con el token de cada vendedor
  for (const sellerId of sellerIds) {
    try {
      const accessToken = await getValidAccessToken(sellerId);
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        paymentData = await response.json();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!paymentData) {
    console.error(`No se pudo obtener el pago ${paymentId} de la API de MP`);
    return;
  }

  const externalReference = paymentData.external_reference;
  if (!externalReference) {
    console.error(`Pago ${paymentId} sin external_reference`);
    return;
  }

  // Fulfillment agnóstico del proveedor (compartido con el webhook de PayPal).
  await applyPaymentAction({
    admin,
    externalReference,
    paymentId,
    status: paymentData.status,
  });
}
