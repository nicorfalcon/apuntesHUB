import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";

interface OrderItemInput {
  type: "resume" | "bundle";
  id: string;
}

/**
 * POST /api/orders/checkout
 * Crea una orden pendiente (un pago a UN vendedor con 1+ ítems: apuntes y/o bundles)
 * y devuelve la preferencia de Mercado Pago. Lo usa tanto la compra directa de un
 * bundle como el checkout de un grupo del carrito.
 *
 * Body: { sellerId: string, items: [{ type: "resume"|"bundle", id: string }] }
 *
 * Reusa el patrón de /api/mercadopago/create-preference y /api/courses/[id]/checkout.
 * La validación de negocio (propiedad, montos, MP conectado) vive en la RPC
 * purchase_order; acá no se confía en el cliente para el precio.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sellerId, items, couponCode } = (await request.json()) as {
    sellerId?: string;
    items?: OrderItemInput[];
    couponCode?: string;
  };

  if (!sellerId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Faltan campos: sellerId, items" },
      { status: 400 }
    );
  }

  // Crear la orden pendiente (valida todo server-side y calcula montos, cupón incluido:
  // el código se re-valida contra los cupones del vendedor, no se confía en el cliente).
  const { data: orderData, error: orderError } = await supabase.rpc(
    "purchase_order",
    {
      p_seller_id: sellerId,
      p_items: items,
      ...(couponCode ? { p_coupon_code: couponCode } : {}),
    }
  );

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 });
  }

  const { order_id: orderId, free } = orderData as {
    order_id: string;
    amount: number;
    status: string;
    free?: boolean;
  };

  // Total 0 (material gratis o cupón que cubre todo): la RPC ya completó la orden y
  // otorgó los apuntes. Mercado Pago no admite preferencias con monto 0.
  if (free) {
    return NextResponse.json({ free: true, orderId, redirectUrl: "/my-purchases" });
  }

  const admin = createAdminClient();

  // Traer los ítems para armar las líneas del pago (título + precio).
  const [{ data: order }, { data: orderItems }] = await Promise.all([
    admin.from("orders").select("amount, platform_fee, seller_id").eq("id", orderId).single(),
    admin
      .from("order_items")
      .select("item_type, unit_price, resumes(title), bundles(title)")
      .eq("order_id", orderId),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(order.seller_id);
  } catch (err) {
    console.error("Error al obtener token del vendedor:", err);
    return NextResponse.json(
      { error: "El vendedor no tiene Mercado Pago configurado correctamente" },
      { status: 400 }
    );
  }

  const mpItems = (orderItems ?? []).map((it, idx) => {
    const row = it as Record<string, unknown>;
    const resume = row.resumes as { title: string } | null;
    const bundle = row.bundles as { title: string } | null;
    const title =
      it.item_type === "bundle"
        ? `Paquete: ${bundle?.title ?? "Pack de apuntes"}`
        : (resume?.title ?? "Apunte");
    return {
      id: `${orderId}-${idx}`,
      title,
      quantity: 1,
      unit_price: Number(it.unit_price),
      currency_id: "ARS",
    };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  try {
    const mpPreference = await preference.create({
      body: {
        items: mpItems,
        back_urls: {
          success: `${appUrl}/checkout/order/success?order_id=${orderId}`,
          failure: `${appUrl}/checkout/order/failure?order_id=${orderId}`,
          pending: `${appUrl}/checkout/order/pending?order_id=${orderId}`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        external_reference: `order:${orderId}`,
        marketplace_fee: Number(order.platform_fee),
      },
    });

    await admin
      .from("orders")
      .update({ mp_preference_id: mpPreference.id })
      .eq("id", orderId);

    return NextResponse.json({
      orderId,
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
    });
  } catch (err) {
    console.error("Error al crear preferencia MP de la orden:", err);
    const errorDetail = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: "Error al crear la preferencia de pago", detail: errorDetail },
      { status: 500 }
    );
  }
}
