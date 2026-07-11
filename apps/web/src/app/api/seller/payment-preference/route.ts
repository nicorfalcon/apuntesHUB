import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportedCurrency } from "@/lib/paypal/currencies";

/**
 * POST /api/seller/payment-preference
 * Permite al vendedor elegir su proveedor preferido (cuando tiene ambos conectados)
 * y/o la moneda de payout de PayPal.
 *
 * Body: { provider?: "mercadopago" | "paypal", currency?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    currency?: string;
  };

  const admin = createAdminClient();

  // Actualizar proveedor preferido, validando que lo tenga conectado.
  if (body.provider !== undefined) {
    if (body.provider !== "mercadopago" && body.provider !== "paypal") {
      return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
    }

    const table =
      body.provider === "mercadopago"
        ? "seller_mp_credentials"
        : "seller_paypal_credentials";
    const { data: creds } = await admin
      .from(table)
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!creds) {
      return NextResponse.json(
        { error: "No tenés ese método de cobro conectado" },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from("profiles")
      .update({ preferred_payment_provider: body.provider })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar la preferencia" },
        { status: 500 }
      );
    }
  }

  // Actualizar moneda de payout de PayPal.
  if (body.currency !== undefined) {
    if (!isSupportedCurrency(body.currency)) {
      return NextResponse.json({ error: "Moneda no soportada" }, { status: 400 });
    }
    const { error } = await admin
      .from("seller_paypal_credentials")
      .update({ payout_currency: body.currency })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json(
        { error: "No se pudo guardar la moneda" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
