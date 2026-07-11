import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPartnerReferral } from "@/lib/paypal/onboarding";

/**
 * GET /api/paypal/onboard
 * Genera un Partner Referral y redirige al vendedor a PayPal para conectar su cuenta.
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/profile", appUrl));
  }

  try {
    const { actionUrl } = await createPartnerReferral({
      sellerId: user.id,
      returnUrl: `${appUrl}/api/paypal/onboard/callback`,
    });
    return NextResponse.redirect(actionUrl);
  } catch (err) {
    console.error("Error al iniciar onboarding de PayPal:", err);
    return NextResponse.redirect(
      new URL("/profile?paypal=error&reason=onboard_init", appUrl)
    );
  }
}
