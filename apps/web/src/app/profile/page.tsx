import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileSettingsShell } from "./profile-settings-shell";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/profile");

  // Fetch profile y credenciales de cobro (MP y PayPal) en paralelo
  const admin = createAdminClient();
  const [{ data: profile }, { data: mpCreds }, { data: paypalCreds }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      admin
        .from("seller_mp_credentials")
        .select("connected_at")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("seller_paypal_credentials")
        .select("connected_at, payout_currency, payments_receivable")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const oauthUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/mercadopago/oauth/callback`)}`;
  const paypalOnboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/paypal/onboard`;

  const hasPassword = (user.identities ?? []).some((i) => i.provider === "email");

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-16">
      <header className="mb-10 lg:ml-72">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi perfil</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-sand-300/75">
          Actualizá tu información pública.
        </p>
      </header>

      <ProfileSettingsShell
        userId={user.id}
        userEmail={user.email ?? ""}
        hasPassword={hasPassword}
        profile={profile}
        hasMpConnected={!!mpCreds}
        connectedAt={mpCreds?.connected_at ?? null}
        oauthUrl={oauthUrl}
        hasPaypalConnected={!!paypalCreds}
        paypalConnectedAt={paypalCreds?.connected_at ?? null}
        payoutCurrency={paypalCreds?.payout_currency ?? "USD"}
        paymentsReceivable={paypalCreds?.payments_receivable ?? false}
        paypalOnboardUrl={paypalOnboardUrl}
        preferredProvider={
          (profile?.preferred_payment_provider as
            | "mercadopago"
            | "paypal"
            | null) ?? null
        }
      />
    </div>
  );
}
