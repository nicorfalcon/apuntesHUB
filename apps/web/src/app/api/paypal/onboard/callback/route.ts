import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchantOnboardingStatus } from "@/lib/paypal/onboarding";
import { DEFAULT_PAYPAL_CURRENCY } from "@/lib/paypal/currencies";

/**
 * GET /api/paypal/onboard/callback
 * PayPal redirige acá cuando el vendedor termina de conectar su cuenta.
 * Query params típicos: merchantIdInPayPal, merchantId (= tracking_id), permissionsGranted,
 * consentStatus, isEmailConfirmed, accountStatus.
 *
 * Guardamos el merchant_id y confirmamos el estado real vía la API (el redirect no es
 * confiable por sí solo). El estado definitivo también llega por webhook.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const params = request.nextUrl.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/profile", appUrl));
  }

  const merchantIdInPayPal = params.get("merchantIdInPayPal");
  const permissionsGranted = params.get("permissionsGranted") === "true";

  if (!merchantIdInPayPal || !permissionsGranted) {
    return NextResponse.redirect(
      new URL("/profile?paypal=error&reason=not_granted", appUrl)
    );
  }

  // Confirmar el estado real del merchant (payments_receivable, email confirmado).
  // El tracking_id que enviamos fue el propio user.id.
  let paymentsReceivable = false;
  let primaryEmailConfirmed = params.get("isEmailConfirmed") === "true";
  try {
    const status = await getMerchantOnboardingStatus(user.id);
    paymentsReceivable = status.paymentsReceivable;
    primaryEmailConfirmed = status.primaryEmailConfirmed || primaryEmailConfirmed;
  } catch (err) {
    // No es fatal: guardamos igual y el webhook actualizará payments_receivable.
    console.error("No se pudo confirmar el estado del merchant PayPal:", err);
  }

  const admin = createAdminClient();

  const { error: upsertError } = await admin
    .from("seller_paypal_credentials")
    .upsert(
      {
        id: user.id,
        paypal_merchant_id: merchantIdInPayPal,
        paypal_tracking_id: user.id,
        payout_currency: DEFAULT_PAYPAL_CURRENCY,
        payments_receivable: paymentsReceivable,
        primary_email_confirmed: primaryEmailConfirmed,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    console.error("Error al guardar credenciales de PayPal:", upsertError);
    return NextResponse.redirect(
      new URL("/profile?paypal=error&reason=save_credentials", appUrl)
    );
  }

  // Promover rol buyer → both (igual que el callback de MP).
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "buyer") {
    await admin.from("profiles").update({ role: "both" }).eq("id", user.id);
  }

  return NextResponse.redirect(new URL("/profile?paypal=connected", appUrl));
}
