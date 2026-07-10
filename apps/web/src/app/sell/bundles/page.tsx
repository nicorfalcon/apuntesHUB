import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellNavbar } from "@/components/layout/sell-navbar";
import { BundlesManager, type BundleRow, type SellerResume } from "./bundles-manager";

export const metadata = {
  title: "Paquetes · apuntesHUB",
};

export default async function BundlesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sell/bundles");

  const [{ data: bundles }, { data: resumes }] = await Promise.all([
    supabase
      .from("bundles")
      .select(
        "id, title, description, subject, price, is_published, created_at, bundle_items(resume_id)"
      )
      .eq("seller_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("resumes")
      .select("id, title, subject, price")
      .eq("seller_id", user.id)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="h-14 border-b border-gray-200 bg-white dark:border-white/10 dark:bg-[#101816]" />}>
        <SellNavbar backLabel="Panel de ventas" backHref="/sell/dashboard" />
      </Suspense>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
            Paquetes
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Paquetes por materia
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Armá un combo con varios de tus apuntes a un precio único. El comprador lo
            adquiere en un solo pago y recibe todos los apuntes del paquete.
          </p>
        </header>

        <BundlesManager
          initialBundles={(bundles ?? []) as unknown as BundleRow[]}
          sellerResumes={(resumes ?? []) as SellerResume[]}
        />
      </div>
    </div>
  );
}
