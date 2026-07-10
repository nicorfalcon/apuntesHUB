import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/coupons/validate
 * Valida un código de descuento para un apunte y devuelve el monto con descuento.
 * Para la validación en vivo del botón de compra. Requiere sesión (un comprador no
 * puede leer los cupones del vendedor por RLS: se resuelve vía la RPC security definer).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { code, resumeId } = (await request.json()) as {
    code?: string;
    resumeId?: string;
  };

  if (!code || !resumeId) {
    return NextResponse.json(
      { error: "Faltan campos: code, resumeId" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code,
    p_resume_id: resumeId,
  });

  if (error) {
    return NextResponse.json(
      { valid: false, error: "No se pudo validar el código" },
      { status: 500 }
    );
  }

  // La RPC devuelve { valid, ... } o { valid: false, error }.
  return NextResponse.json(data);
}
