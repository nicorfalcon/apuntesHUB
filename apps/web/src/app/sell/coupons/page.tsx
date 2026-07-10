import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CouponsManager, type CouponRow } from "./coupons-manager";

export const metadata = {
  title: "Códigos de descuento · apuntesHUB",
};

export default async function CouponsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sell/coupons");

  const { data: coupons } = await supabase
    .from("coupons")
    .select(
      "id, code, discount_type, value, max_uses, used_count, expires_at, active, created_at"
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/sell/dashboard" className="hover:text-gray-600">
          Panel de vendedor
        </Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">Códigos de descuento</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">
          Códigos de descuento
        </h1>
        <p className="mt-2 max-w-prose text-sm text-gray-500 dark:text-sand-300/75">
          Creá códigos que tus compradores pueden aplicar en cualquiera de tus
          apuntes publicados. El descuento sale de tu parte; la comisión se calcula
          sobre el monto ya descontado.
        </p>
      </header>

      <CouponsManager
        userId={user.id}
        initialCoupons={(coupons ?? []) as CouponRow[]}
      />
    </div>
  );
}
