import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellNavbar } from "@/components/layout/sell-navbar";
import { discountedPrice } from "@/lib/discounts/direct";
import { CartWorkspace, type CartSellerGroup, type CartEntry } from "./cart-workspace";

export const metadata = {
  title: "Carrito · apuntesHUB",
};

type CartRow = {
  id: string;
  item_type: "resume" | "bundle";
  resume_id: string | null;
  bundle_id: string | null;
  resumes: {
    id: string;
    title: string;
    price: number;
    discount_percent: number | null;
    seller_id: string;
    status: string;
    deleted_at: string | null;
    profiles: { display_name: string | null } | null;
  } | null;
  bundles: {
    id: string;
    title: string;
    price: number;
    seller_id: string;
    is_published: boolean;
    deleted_at: string | null;
    profiles: { display_name: string | null } | null;
  } | null;
};

export default async function CartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/carrito");

  const { data: rows } = await supabase
    .from("cart_items")
    .select(
      `id, item_type, resume_id, bundle_id,
       resumes(id, title, price, discount_percent, seller_id, status, deleted_at, profiles!seller_id(display_name)),
       bundles(id, title, price, seller_id, is_published, deleted_at, profiles!seller_id(display_name))`
    )
    .eq("buyer_id", user.id)
    .order("added_at", { ascending: false });

  // Normalizar a entradas válidas (descartar ítems ya no disponibles).
  const entries: CartEntry[] = [];
  for (const r of (rows ?? []) as unknown as CartRow[]) {
    if (r.item_type === "resume" && r.resumes) {
      if (r.resumes.status !== "published" || r.resumes.deleted_at) continue;
      const listPrice = Number(r.resumes.price);
      const discount = Number(r.resumes.discount_percent ?? 0);
      entries.push({
        cartId: r.id,
        type: "resume",
        itemId: r.resumes.id,
        title: r.resumes.title,
        price: discountedPrice(listPrice, discount),
        listPrice,
        discountPercent: discount,
        sellerId: r.resumes.seller_id,
        sellerName: r.resumes.profiles?.display_name ?? "Vendedor",
      });
    } else if (r.item_type === "bundle" && r.bundles) {
      if (!r.bundles.is_published || r.bundles.deleted_at) continue;
      entries.push({
        cartId: r.id,
        type: "bundle",
        itemId: r.bundles.id,
        title: r.bundles.title,
        price: Number(r.bundles.price),
        listPrice: Number(r.bundles.price),
        discountPercent: 0,
        sellerId: r.bundles.seller_id,
        sellerName: r.bundles.profiles?.display_name ?? "Vendedor",
      });
    }
  }

  // Agrupar por vendedor (un pago de MP por grupo).
  const groupsMap = new Map<string, CartSellerGroup>();
  for (const e of entries) {
    let g = groupsMap.get(e.sellerId);
    if (!g) {
      g = { sellerId: e.sellerId, sellerName: e.sellerName, entries: [], subtotal: 0 };
      groupsMap.set(e.sellerId, g);
    }
    g.entries.push(e);
    g.subtotal += e.price;
  }
  const groups = [...groupsMap.values()];

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="h-14 border-b border-gray-200 bg-white dark:border-white/10 dark:bg-[#101816]" />}>
        <SellNavbar backLabel="Explorar" backHref="/explorar" />
      </Suspense>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
            Carrito
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Tu carrito
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Los materiales se agrupan por vendedor. Cada vendedor se paga por separado, de
            forma segura con Mercado Pago.
          </p>
        </header>

        <div className="mt-8">
          <CartWorkspace initialGroups={groups} />
        </div>
      </div>
    </div>
  );
}
