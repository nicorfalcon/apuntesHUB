import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellNavbar } from "@/components/layout/sell-navbar";
import { ResumeForm } from "../resume-form";

export default async function NuevoApuntePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/sell/new");

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="h-14 border-b border-gray-200 bg-white" />}>
        <SellNavbar />
      </Suspense>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Publicar apunte
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Completá los datos de tu resumen y subí el archivo PDF.
          </p>
        </div>
        <ResumeForm userId={user.id} />
      </div>
    </div>
  );
}
