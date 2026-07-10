import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellNavbar } from "@/components/layout/sell-navbar";
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
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="h-14 border-b border-gray-200 bg-white dark:border-white/10 dark:bg-[#101816]" />}>
        <SellNavbar backLabel="Panel de ventas" backHref="/sell/dashboard" />
      </Suspense>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
            Códigos
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Códigos de descuento
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
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
    </div>
  );
}
