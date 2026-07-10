import Link from "next/link";
import { ArrowLeft, Ticket } from "lucide-react";
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
            <Ticket className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-200/90">
            Códigos
          </p>
        </div>
        <h1 className="mt-3 font-serif text-4xl text-foreground">
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
