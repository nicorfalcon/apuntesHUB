import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";

/**
 * GET /api/orders/[id]/status?payment_id=<id>
 * Estado actual de una orden. Usado para polling desde la página de éxito.
 *
 * Si la orden sigue pendiente y volvemos de Mercado Pago con un payment_id, no esperamos
 * al webhook: consultamos el pago contra la API de MP y, si está aprobado para ESTA orden,
 * la completamos acá mismo. El webhook sigue siendo la fuente principal (complete_order es
 * idempotente); esto es la red de contención para cuando tarda, se pierde o falla la firma,
 * que si no deja al comprador pagando sin recibir el material.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("status, seller_id")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  if (order.status !== "pending") {
    return NextResponse.json({ status: order.status });
  }

  const paymentId = request.nextUrl.searchParams.get("payment_id");
  if (!paymentId) {
    return NextResponse.json({ status: order.status });
  }

  const reconciled = await reconcileWithMercadoPago(id, order.seller_id, paymentId);
  return NextResponse.json({ status: reconciled ? "completed" : order.status });
}

/**
 * Confirma contra la API de MP que el pago existe, está aprobado y corresponde a esta
 * orden; recién ahí la completa. Nunca se confía en los query params del navegador: el
 * comprador podría inventarlos.
 */
async function reconcileWithMercadoPago(
  orderId: string,
  sellerId: string,
  paymentId: string
): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(sellerId);
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;

    const payment = (await res.json()) as {
      status?: string;
      external_reference?: string;
    };

    if (payment.status !== "approved") return false;
    if (payment.external_reference !== `order:${orderId}`) return false;

    const admin = createAdminClient();
    const { error } = await admin.rpc("complete_order", {
      p_order_id: orderId,
      p_payment_id: paymentId,
    });
    if (error) {
      console.error("[order-status] complete_order falló al reconciliar:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[order-status] no se pudo reconciliar con MP:", err);
    return false;
  }
}
