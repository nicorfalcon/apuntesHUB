import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CartItemInput {
  type: "resume" | "bundle";
  id: string;
}

/**
 * POST /api/coupons/validate-cart
 * Valida un código contra TODO el carrito y devuelve a qué apuntes aplica y cuánto
 * descuenta en cada uno. Un cupón es de un vendedor y vale para sus apuntes, así que en un
 * carrito con varios vendedores puede aplicar solo a una parte: la respuesta viene abierta
 * por vendedor (que es como se paga).
 *
 * El descuento acá es informativo; purchase_order lo recalcula al cobrar.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { code, items } = (await request.json()) as {
    code?: string;
    items?: CartItemInput[];
  };

  if (!code || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Faltan campos: code, items" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("validate_coupon_cart", {
    p_code: code,
    p_items: items,
  });

  if (error) {
    return NextResponse.json(
      { valid: false, error: "No se pudo validar el código" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
