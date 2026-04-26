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

  // Fetch profile y credenciales MP en paralelo
  const admin = createAdminClient();
  const [{ data: profile }, { data: mpCreds }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    admin
      .from("seller_mp_credentials")
      .select("connected_at")
      .eq("id", user.id)
      .single(),
  ]);

  const oauthUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/mercadopago/oauth/callback`)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <header className="mb-10 lg:ml-72">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi perfil</h1>
        <p className="mt-2 text-sm text-gray-400">
          Actualizá tu información pública.
        </p>
      </header>

      <ProfileSettingsShell
        userId={user.id}
        profile={profile}
        hasMpConnected={!!mpCreds}
        connectedAt={mpCreds?.connected_at ?? null}
        oauthUrl={oauthUrl}
      />
    </div>
  );
}
