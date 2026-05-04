import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";
import {
  sendCourseSaleNotification,
  sendResumeSaleNotification,
} from "@/lib/email/sale-notifications";

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
 * Valida la firma HMAC-SHA256 del webhook de Mercado Pago.
 */
function validateSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string | null
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("MP_WEBHOOK_SECRET no configurado");
    return false;
  }

  // Parsear ts y v1 del header x-signature
  const parts = xSignature.split(",");
  let ts: string | null = null;
  let hash: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "ts") ts = value?.trim() ?? null;
    if (key?.trim() === "v1") hash = value?.trim() ?? null;
  }

  if (!ts || !hash) return false;

  // Construir manifest y calcular HMAC
  const manifest = `id:${dataId ?? ""};request-id:${xRequestId};ts:${ts};`;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(hash, "hex")
  );
}

/**
 * Consulta el pago en la API de MP y actualiza la compra/inscripción según el estado.
 * Soporta dos tipos de external_reference:
 *   - "<uuid>" → compra de apunte (purchases)
 *   - "course_enrollment:<uuid>" → inscripción a curso grabado (course_enrollments)
 */
async function processPaymentNotification(paymentId: string) {
  const admin = createAdminClient();

  // Idempotencia: si ya fue procesado en cualquiera de las dos tablas, salir.
  const [{ data: existingPurchase }, { data: existingEnrollment }] = await Promise.all([
    admin.from("purchases").select("id, status").eq("payment_id", paymentId).maybeSingle(),
    admin
      .from("course_enrollments")
      .select("id, status")
      .eq("payment_id", paymentId)
      .maybeSingle(),
  ]);

  if (
    existingPurchase?.status === "completed" ||
    existingEnrollment?.status === "completed"
  ) {
    return;
  }

  // Buscar vendedores con pagos pendientes en cualquiera de las dos tablas
  // para probar consultando el pago con sus access_tokens.
  const [{ data: pendingPurchases }, { data: pendingEnrollments }] = await Promise.all([
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
  ]);

  const sellerIdsFromPurchases = (pendingPurchases ?? []).map((p) => p.seller_id);
  const sellerIdsFromEnrollments = (pendingEnrollments ?? []).map((row) => {
    const course = (row as Record<string, unknown>).recorded_courses as
      | { author_id: string }
      | null;
    return course?.author_id;
  }).filter((id): id is string => Boolean(id));

  const sellerIds = Array.from(
    new Set([...sellerIdsFromPurchases, ...sellerIdsFromEnrollments])
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

  const isCourse = externalReference.startsWith("course_enrollment:");
  const targetId = isCourse
    ? externalReference.slice("course_enrollment:".length)
    : externalReference;
  const approvedRpc = isCourse ? "complete_course_enrollment" : "complete_purchase";
  const failedRpc = isCourse ? "fail_course_enrollment" : "fail_purchase";
  const idArgKey = isCourse ? "p_enrollment_id" : "p_purchase_id";

  if (paymentData.status === "approved") {
    await admin.rpc(approvedRpc, {
      [idArgKey]: targetId,
      p_payment_id: paymentId,
    });

    try {
      if (isCourse) {
        await sendCourseSaleNotification(admin, targetId, paymentId);
      } else {
        await sendResumeSaleNotification(admin, targetId, paymentId);
      }
    } catch (emailError) {
      console.error("No se pudo enviar email de venta:", emailError);
    }
  } else if (
    paymentData.status === "rejected" ||
    paymentData.status === "cancelled"
  ) {
    await admin.rpc(failedRpc, {
      [idArgKey]: targetId,
      p_payment_id: paymentId,
    });
  }
  // pending / in_process: no hacer nada, esperar siguiente notificación
}
