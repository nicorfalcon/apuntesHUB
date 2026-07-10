import Link from "next/link";
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
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/sell/dashboard" className="hover:text-gray-600">
          Panel de vendedor
        </Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">Paquetes</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">Paquetes por materia</h1>
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
