import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
       resumes(id, title, price, seller_id, status, deleted_at, profiles!seller_id(display_name)),
       bundles(id, title, price, seller_id, is_published, deleted_at, profiles!seller_id(display_name))`
    )
    .eq("buyer_id", user.id)
    .order("added_at", { ascending: false });

  // Normalizar a entradas válidas (descartar ítems ya no disponibles).
  const entries: CartEntry[] = [];
  for (const r of (rows ?? []) as unknown as CartRow[]) {
    if (r.item_type === "resume" && r.resumes) {
      if (r.resumes.status !== "published" || r.resumes.deleted_at) continue;
      entries.push({
        cartId: r.id,
        type: "resume",
        itemId: r.resumes.id,
        title: r.resumes.title,
        price: Number(r.resumes.price),
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
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl text-foreground">Tu carrito</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-sand-300/75">
        Los materiales se agrupan por vendedor. Cada vendedor se paga por separado, de
        forma segura con Mercado Pago.
      </p>

      <div className="mt-8">
        <CartWorkspace initialGroups={groups} />
      </div>
    </div>
  );
}
