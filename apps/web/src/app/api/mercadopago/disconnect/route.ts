import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/mercadopago/disconnect
 * Desconecta la cuenta de Mercado Pago del vendedor.
 * Los apuntes del vendedor no podrán comprarse hasta reconectar.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("seller_mp_credentials")
    .delete()
    .eq("id", user.id);

  if (error) {
    console.error("Error al desconectar MP:", error);
    return NextResponse.json(
      { error: "Error al desconectar Mercado Pago" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
