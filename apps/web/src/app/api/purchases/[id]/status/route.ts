import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/purchases/[id]/status
 * Retorna el estado actual de una compra. Usado para polling desde la página de éxito.
 */
export async function GET(
  _request: NextRequest,
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
    .select("status")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .single();

  if (error || !purchase) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json({ status: purchase.status });
}
