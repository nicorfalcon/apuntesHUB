"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export interface CartEntry {
  cartId: string;
  type: "resume" | "bundle";
  itemId: string;
  title: string;
  price: number;
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
        <p className="text-sm text-gray-400">Tu carrito está vacío.</p>
        <Link
          href="/explorar"
          className="mt-3 inline-block text-sm font-semibold text-accent-700 hover:underline dark:text-accent-100"
        >
          Explorar apuntes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section
          key={group.sellerId}
          className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {group.sellerName}
            </h2>
            <span className="text-xs text-gray-400">
              {group.entries.length} ítem{group.entries.length === 1 ? "" : "s"}
            </span>
          </header>

          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {group.entries.map((e) => (
              <li key={e.cartId} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {e.type === "bundle" ? `Paquete: ${e.title}` : e.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm font-medium text-foreground">
                    ${e.price.toLocaleString("es-AR")}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEntry(e)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/10">
            <span className="text-sm text-gray-500 dark:text-sand-300/75">
              Subtotal:{" "}
              <span className="font-semibold text-foreground">
                ${group.subtotal.toLocaleString("es-AR")}
              </span>
            </span>
            <button
              type="button"
              onClick={() => checkoutGroup(group)}
              disabled={payingSeller !== null}
              className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {payingSeller === group.sellerId
                ? "Redirigiendo…"
                : "Pagar con Mercado Pago"}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
