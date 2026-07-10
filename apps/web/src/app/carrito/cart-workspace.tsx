"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export interface CartEntry {
  cartId: string;
  type: "resume" | "bundle";
  itemId: string;
  title: string;
  price: number;
  listPrice: number;
  discountPercent: number;
  sellerId: string;
  sellerName: string;
}

export interface CartSellerGroup {
  sellerId: string;
  sellerName: string;
  entries: CartEntry[];
  subtotal: number;
}

interface CartWorkspaceProps {
  initialGroups: CartSellerGroup[];
}

function formatArs(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

export function CartWorkspace({ initialGroups }: CartWorkspaceProps) {
  const [groups, setGroups] = useState<CartSellerGroup[]>(initialGroups);
  const [payingSeller, setPayingSeller] = useState<string | null>(null);

  async function removeEntry(entry: CartEntry) {
    const supabase = createClient();
    const { error } = await supabase.from("cart_items").delete().eq("id", entry.cartId);
    if (error) {
      toast.error("No se pudo quitar el ítem.");
      return;
    }
    setGroups((prev) =>
      prev
        .map((g) =>
          g.sellerId === entry.sellerId
            ? {
                ...g,
                entries: g.entries.filter((e) => e.cartId !== entry.cartId),
                subtotal: g.subtotal - entry.price,
              }
            : g
        )
        .filter((g) => g.entries.length > 0)
    );
    window.dispatchEvent(new Event("cart-updated"));
  }

  async function checkoutGroup(group: CartSellerGroup) {
    setPayingSeller(group.sellerId);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: group.sellerId,
          items: group.entries.map((e) => ({ type: e.type, id: e.itemId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo iniciar el pago.");
        setPayingSeller(null);
        return;
      }
      if (data.initPoint) {
        window.location.href = data.initPoint;
        return; // mantener estado mientras redirige
      }
      toast.error("No se obtuvo el enlace de pago.");
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.");
    }
    setPayingSeller(null);
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center dark:border-white/10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
          <ShoppingBag className="h-6 w-6" strokeWidth={1.7} />
        </div>
        <p className="mt-5 text-2xl font-bold tracking-tight text-foreground">Tu carrito está vacío</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Cuando agregues apuntes o paquetes, se van a agrupar acá por vendedor.
        </p>
        <Link
          href="/explorar"
          className="mt-6 inline-flex items-center rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          Explorar apuntes
        </Link>
      </div>
    );
  }

  const totalSavings = groups.reduce(
    (acc, g) =>
      acc +
      g.entries.reduce((s, e) => s + Math.max(0, e.listPrice - e.price), 0),
    0
  );

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const groupSavings = group.entries.reduce(
          (s, e) => s + Math.max(0, e.listPrice - e.price),
          0
        );
        return (
          <section
            key={group.sellerId}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0f1e1a]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-300/12 dark:text-accent-100">
                  <Store className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <h2 className="text-sm font-semibold text-foreground">
                  {group.sellerName}
                </h2>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {group.entries.length} ítem{group.entries.length === 1 ? "" : "s"}
              </span>
            </header>

            <ul className="divide-y divide-gray-100 px-5 dark:divide-white/10">
              {group.entries.map((e) => {
                const discounted = e.discountPercent > 0 && e.price < e.listPrice;
                return (
                  <li
                    key={e.cartId}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.type === "bundle" ? `Paquete: ${e.title}` : e.title}
                      </p>
                      {discounted && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                          -{e.discountPercent}% aplicado
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <span className="text-sm font-semibold text-foreground">
                          {formatArs(e.price)}
                        </span>
                        {discounted && (
                          <span className="ml-1.5 text-xs text-gray-400 line-through">
                            {formatArs(e.listPrice)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEntry(e)}
                        aria-label={`Quitar ${e.title}`}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Subtotal: </span>
                <span className="font-serif text-xl text-foreground">
                  {formatArs(group.subtotal)}
                </span>
                {groupSavings > 0 && (
                  <span className="ml-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    ahorrás {formatArs(groupSavings)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => checkoutGroup(group)}
                disabled={payingSeller !== null}
                className="rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
              >
                {payingSeller === group.sellerId
                  ? "Redirigiendo…"
                  : "Pagar con Mercado Pago"}
              </button>
            </div>
          </section>
        );
      })}

      {totalSavings > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Estás ahorrando{" "}
          <span className="font-semibold text-rose-600 dark:text-rose-400">
            {formatArs(totalSavings)}
          </span>{" "}
          en descuentos.
        </p>
      )}
    </div>
  );
}
