import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/paypal/disconnect
 * Desconecta la cuenta de PayPal del vendedor. Si su preferencia era PayPal, la limpia.
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
    .from("seller_paypal_credentials")
    .delete()
    .eq("id", user.id);

  if (error) {
    console.error("Error al desconectar PayPal:", error);
    return NextResponse.json(
      { error: "Error al desconectar PayPal" },
      { status: 500 }
    );
  }

  // Si la preferencia apuntaba a PayPal, resetearla (queda MP si lo tiene).
  await admin
    .from("profiles")
    .update({ preferred_payment_provider: null })
    .eq("id", user.id)
    .eq("preferred_payment_provider", "paypal");

  return NextResponse.json({ success: true });
}
