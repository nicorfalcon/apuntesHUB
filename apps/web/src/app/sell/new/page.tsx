import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeForm } from "../resume-form";

export default async function NuevoApuntePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sell/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Publicar apunte
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Completá los datos de tu resumen y subí el archivo PDF.
      </p>
      <div className="mt-8">
        <ResumeForm userId={user.id} />
      </div>
    </div>
  );
}
