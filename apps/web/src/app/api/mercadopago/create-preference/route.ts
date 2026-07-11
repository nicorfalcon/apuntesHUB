import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";
import { resolveSellerProvider } from "@/lib/payments/resolve-provider";
import { startPayPalCheckout } from "@/lib/paypal/checkout";

/**
 * POST /api/mercadopago/create-preference
 * Crea una compra pendiente y genera una preferencia de pago de Mercado Pago.
 * Usa el access_token del vendedor (marketplace con OAuth).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { resumeId, couponCode } = body as {
    resumeId: string;
    couponCode?: string;
  };

  if (!resumeId) {
    return NextResponse.json({ error: "resumeId es requerido" }, { status: 400 });
  }

  // Crear/reutilizar compra pendiente via RPC (valida reglas de negocio en la DB,
  // incluido el cupón: se re-valida server-side, no se confía en el cliente).
  const { data: purchaseData, error: purchaseError } = await supabase.rpc(
    "purchase_resume",
    {
      p_resume_id: resumeId,
      ...(couponCode ? { p_coupon_code: couponCode } : {}),
    }
  );

  if (purchaseError) {
    return NextResponse.json(
      { error: purchaseError.message },
      { status: 400 }
    );
  }

  const { purchase_id: purchaseId } = purchaseData as {
    purchase_id: string;
    status: string;
    reused: boolean;
  };

  // Obtener datos del resume para la preferencia
  const admin = createAdminClient();
  const { data: purchase } = await admin
    .from("purchases")
    .select("amount, seller_id, platform_fee, resumes(title)")
    .eq("id", purchaseId)
    .single();

  if (!purchase) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 }
    );
  }

  const resume = (purchase as Record<string, unknown>).resumes as { title: string } | null;
  const sellerId = purchase.seller_id;

  // Resolver el proveedor de cobro del vendedor (MP o PayPal).
  const { provider, paypal } = await resolveSellerProvider(admin, sellerId);

  if (provider === "paypal" && paypal) {
    try {
      const { orderId, redirectUrl } = await startPayPalCheckout({
        paypal,
        items: [{ name: resume?.title ?? "Apunte", amount: Number(purchase.amount) }],
        customId: purchaseId, // apunte suelto: external_reference sin prefijo
        platformFee: Number(purchase.platform_fee),
        description: resume?.title ?? "Apunte",
        cancelPath: `/resume/${resumeId}`,
      });
      await admin
        .from("purchases")
        .update({ paypal_order_id: orderId })
        .eq("id", purchaseId);
      return NextResponse.json({ redirectUrl });
    } catch (err) {
      console.error("Error al crear la orden de PayPal:", err);
      const detail = err instanceof Error ? err.message : JSON.stringify(err);
      return NextResponse.json(
        { error: "Error al crear la orden de pago", detail },
        { status: 500 }
      );
    }
  }

  // Obtener access token vigente del vendedor (Mercado Pago)
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(sellerId);
  } catch (err) {
    console.error("Error al obtener token del vendedor:", err);
    return NextResponse.json(
      { error: "El vendedor no tiene Mercado Pago configurado correctamente" },
      { status: 400 }
    );
  }

  // Crear preferencia de pago con el SDK de MP
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  try {
    const mpPreference = await preference.create({
      body: {
        items: [
          {
            id: resumeId,
            title: resume?.title ?? "Apunte",
            quantity: 1,
            unit_price: Number(purchase.amount),
            currency_id: "ARS",
          },
        ],
        back_urls: {
          success: `${appUrl}/checkout/success?purchase_id=${purchaseId}`,
          failure: `${appUrl}/checkout/failure?purchase_id=${purchaseId}`,
          pending: `${appUrl}/checkout/pending?purchase_id=${purchaseId}`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        external_reference: purchaseId,
        marketplace_fee: Number(purchase.platform_fee),
      },
    });

    // Guardar el preference ID en la compra
    await admin
      .from("purchases")
      .update({ mp_preference_id: mpPreference.id })
      .eq("id", purchaseId);

    return NextResponse.json({
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
    });
  } catch (err) {
    console.error("Error al crear preferencia de MP:", err);
    // Exponer el detalle del error para facilitar el debugging
    const errorDetail = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: "Error al crear la preferencia de pago", detail: errorDetail },
      { status: 500 }
    );
  }
}
