import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/sell/dashboard"
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 -ml-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:hover:bg-white/10 dark:focus-visible:ring-accent-300/30"
      >
        <ArrowLeft className="h-4 w-4" />
        Panel de vendedor
      </Link>

      <header className="mt-5 mb-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-300/12 dark:text-accent-100">
            <Package className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-200/90">
            Paquetes
          </p>
        </div>
        <h1 className="mt-3 font-serif text-4xl text-foreground">Paquetes por materia</h1>
        <p className="mt-2 max-w-prose text-sm text-gray-500 dark:text-sand-300/75">
          Armá un combo con varios de tus apuntes a un precio único. El comprador lo
          adquiere en un solo pago y recibe todos los apuntes del paquete.
        </p>
      </header>

      <BundlesManager
        initialBundles={(bundles ?? []) as unknown as BundleRow[]}
        sellerResumes={(resumes ?? []) as SellerResume[]}
      />
    </div>
  );
}
