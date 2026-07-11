import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";

/**
 * GET /api/purchases/[id]/status?payment_id=<id>
 * Retorna el estado actual de una compra. Usado para polling desde la página de éxito.
 *
 * Si sigue pendiente y volvemos de Mercado Pago con un payment_id, confirmamos el pago
 * contra la API de MP y acreditamos la compra en el acto, sin esperar al webhook (que puede
 * tardar, perderse o fallar). complete_purchase es idempotente, así que si el webhook llega
 * después no duplica nada.
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

  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("status, seller_id")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .single();

  if (error || !purchase) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 }
    );
  }

  if (purchase.status !== "pending") {
    return NextResponse.json({ status: purchase.status });
  }

  const paymentId = request.nextUrl.searchParams.get("payment_id");
  if (!paymentId) {
    return NextResponse.json({ status: purchase.status });
  }

  const acredited = await reconcileWithMercadoPago(id, purchase.seller_id, paymentId);
  return NextResponse.json({ status: acredited ? "completed" : purchase.status });
}

/**
 * Verifica contra MP que el pago exista, esté aprobado y corresponda a ESTA compra; recién
 * ahí la acredita. Nunca se confía en los query params del navegador.
 */
async function reconcileWithMercadoPago(
  purchaseId: string,
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
    // La compra de un apunte suelto va sin prefijo en el external_reference.
    if (payment.external_reference !== purchaseId) return false;

    const admin = createAdminClient();
    const { error } = await admin.rpc("complete_purchase", {
      p_purchase_id: purchaseId,
      p_payment_id: paymentId,
    });
    if (error) {
      console.error("[purchase-status] complete_purchase falló al reconciliar:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[purchase-status] no se pudo reconciliar con MP:", err);
    return false;
  }
}
