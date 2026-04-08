import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi perfil</h1>
      <p className="mt-1 text-sm text-gray-500">
        Actualizá tu información pública.
      </p>
      <div className="mt-8">
        <ProfileForm userId={user.id} profile={profile} />
      </div>
    </div>
  );
}
