import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";
import { validateSignature } from "@/lib/mercadopago/webhook-signature";
import { parseExternalReference } from "@/lib/mercadopago/external-reference";
import { resolvePaymentAction } from "@/lib/mercadopago/payment-action";
import {
  sendCourseSaleNotification,
  sendOrderSaleNotification,
  sendResumeSaleNotification,
} from "@/lib/email/sale-notifications";

/**
 * El pago está aprobado pero la RPC que lo acredita falló. Es el único error que amerita
 * pedirle a MP que reintente: hay plata cobrada sin material entregado.
 */
class CompletionFailedError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message);
    this.name = "CompletionFailedError";
  }
}

/**
 * POST /api/webhooks/mercadopago
 * Recibe notificaciones de pago de Mercado Pago.
 * Valida la firma HMAC-SHA256, consulta el pago, y actualiza el estado de la compra.
 */
export async function POST(request: NextRequest) {
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  // 1. Parsear el body ANTES de firmar: el id que entra en el manifest puede venir en el
  // query (`data.id` o `id`) o solo en el body, según cómo notifique MP.
  let body: { type?: string; action?: string; data?: { id?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // 2. Validar firma HMAC-SHA256
  const signatureValid = validateSignature(xSignature, xRequestId, [
    request.nextUrl.searchParams.get("data.id"),
    request.nextUrl.searchParams.get("id"),
    body.data?.id,
  ]);
  if (!signatureValid) {
    console.error("Webhook HMAC validation failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Solo procesar notificaciones de pago
  if (body.type !== "payment" || !body.data?.id) {
    return NextResponse.json({ received: true });
  }

  const paymentId = body.data.id;

  try {
    await processPaymentNotification(paymentId);
  } catch (err) {
    if (err instanceof CompletionFailedError) {
      // El pago está aprobado pero no pudimos acreditarlo: devolvemos 500 para que MP
      // reintente la notificación. Contestar 200 acá dejaba la compra 'pending' para
      // siempre, con la plata ya cobrada.
      console.error("Error acreditando el pago (se pide reintento a MP):", err.cause);
      return NextResponse.json({ error: "completion_failed" }, { status: 500 });
    }

    console.error("Error procesando notificación de pago:", err);
    // Errores de lógica (ej: compra no encontrada): 200 para que MP no reintente al pedo.
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

  // Determinar tipo de transacción e id del recurso desde el external_reference.
  const { kind, id: targetId } = parseExternalReference(externalReference);

  // Mapear el estado del pago a la acción de DB (o null si es pending/in_process).
  const action = resolvePaymentAction(paymentData.status, kind);
  if (!action) return;

  const rpcArgs = { [action.idArg]: targetId, p_payment_id: paymentId };

  if (kind === "tutoring") {
    if (action.shouldNotify) {
      // approved: confirmar la reserva y, si efectivamente cambió de estado,
      // disparar los emails de notificación.
      const { data: didConfirm, error } = await admin.rpc(action.rpc, rpcArgs);

      if (error) {
        throw new CompletionFailedError("No se pudo confirmar la reserva", error);
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
      // rejected / cancelled
      await admin.rpc(action.rpc, rpcArgs);
    }
    return;
  }

  // purchases, course_enrollments u orders (bundle / grupo de carrito)
  const { error: rpcError } = await admin.rpc(action.rpc, rpcArgs);
  if (rpcError) {
    // Silenciarlo dejaba al comprador pagando sin recibir el material y sin rastro en los
    // logs: el pago quedaba aprobado en MP y la compra 'pending' para siempre.
    throw new CompletionFailedError(
      `${action.rpc} falló para ${kind} ${targetId} (pago ${paymentId})`,
      rpcError
    );
  }

  // Email de venta al vendedor (respeta su preferencia de notificaciones).
  if (action.shouldNotify) {
    try {
      if (kind === "course") {
        await sendCourseSaleNotification(admin, targetId, paymentId);
      } else if (kind === "order") {
        await sendOrderSaleNotification(admin, targetId, paymentId);
      } else {
        await sendResumeSaleNotification(admin, targetId, paymentId);
      }
    } catch (emailError) {
      console.error("No se pudo enviar email de venta:", emailError);
    }
  }
}
