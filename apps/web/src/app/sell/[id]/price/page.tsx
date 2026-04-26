import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellNavbar } from "@/components/layout/sell-navbar";
import { PriceForm } from "./price-form";

export default async function GestionarPrecioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/sell/${id}/price`);

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, title, subject, university, price, status")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!resume) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="h-14 border-b border-gray-200 bg-white" />}>
        <SellNavbar backLabel="Panel de ventas" backHref="/sell/dashboard" />
      </Suspense>
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Gestionar precio
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Actualizá el precio de tu apunte en pesos argentinos.
          </p>
        </div>
        <PriceForm
          resumeId={resume.id}
          resumeTitle={resume.title}
          resumeSubject={resume.subject}
          resumeUniversity={resume.university}
          currentPrice={Number(resume.price)}
          currentStatus={resume.status}
        />
      </div>
    </div>
  );
}
