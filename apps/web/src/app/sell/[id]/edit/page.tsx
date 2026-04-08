import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeForm } from "../../resume-form";

export default async function EditarApuntePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=/sell/${id}/edit`);

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!resume) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Editar apunte
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Modificá los datos de tu resumen.
      </p>
      <div className="mt-8">
        <ResumeForm userId={user.id} initial={resume} />
      </div>
    </div>
  );
}
