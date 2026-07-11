"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Store, Tag, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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

/** Cupón aplicado: cuánto descuenta en cada apunte, agrupado por vendedor. */
interface AppliedCoupon {
  code: string;
  /** sellerId -> { total descontado en ese grupo, descuento por apunte } */
  bySeller: Record<string, { discount: number; byResume: Record<string, number> }>;
  totalDiscount: number;
}

interface CouponCartResponse {
  valid: boolean;
  error?: string;
  code?: string;
  total_discount?: number;
  sellers?: {
    seller_id: string;
    discount_amount: number;
    items: { resume_id: string; discount_amount: number; final_amount: number }[];
  }[];
}

function formatArs(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

export function CartWorkspace({ initialGroups }: CartWorkspaceProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<CartSellerGroup[]>(initialGroups);
  const [payingSeller, setPayingSeller] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  /** Descuento del cupón sobre un ítem (0 si no aplica: paquetes, otro vendedor, etc). */
  function couponDiscountFor(entry: CartEntry) {
    if (!coupon || entry.type !== "resume") return 0;
    return coupon.bySeller[entry.sellerId]?.byResume[entry.itemId] ?? 0;
  }

  function couponDiscountForGroup(group: CartSellerGroup) {
    return coupon?.bySeller[group.sellerId]?.discount ?? 0;
  }

  function groupTotal(group: CartSellerGroup) {
    return Math.max(0, group.subtotal - couponDiscountForGroup(group));
  }

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;

    setValidating(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          items: groups.flatMap((g) =>
            g.entries.map((e) => ({ type: e.type, id: e.itemId }))
          ),
        }),
      });
      const data = (await res.json()) as CouponCartResponse;

      if (!data.valid || !data.sellers?.length) {
        setCoupon(null);
        setCouponError(data.error ?? "No se pudo validar el código");
        setValidating(false);
        return;
      }

      const bySeller: AppliedCoupon["bySeller"] = {};
      for (const s of data.sellers) {
        bySeller[s.seller_id] = {
          discount: Number(s.discount_amount),
          byResume: Object.fromEntries(
            s.items.map((i) => [i.resume_id, Number(i.discount_amount)])
          ),
        };
      }
      setCoupon({
        code: data.code ?? code.toUpperCase(),
        bySeller,
        totalDiscount: Number(data.total_discount ?? 0),
      });
    } catch {
      setCoupon(null);
      setCouponError("Error de conexión. Intentá de nuevo.");
    }
    setValidating(false);
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponCode("");
    setCouponError(null);
  }

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
    // El cupón se calculó sobre el carrito anterior: hay que revalidarlo.
    if (coupon) removeCoupon();
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
          // Solo si el código descuenta algo en este grupo; el server lo re-valida igual.
          ...(couponDiscountForGroup(group) > 0 ? { couponCode: coupon!.code } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo iniciar el pago.");
        setPayingSeller(null);
        return;
      }

      // Total 0: no hay pasarela, la orden ya se completó y los apuntes ya son tuyos.
      if (data.free) {
        toast.success("¡Listo! Ya está en tu biblioteca.");
        window.dispatchEvent(new Event("cart-updated"));
        router.push("/my-purchases");
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
      <EmptyState
        icon={ShoppingBag}
        title="Tu carrito está vacío"
        description="Cuando agregues apuntes o paquetes, se van a agrupar acá por vendedor."
        href="/explorar"
        action="Explorar apuntes"
      />
    );
  }

  const directSavings = groups.reduce(
    (acc, g) =>
      acc + g.entries.reduce((s, e) => s + Math.max(0, e.listPrice - e.price), 0),
    0
  );
  const totalSavings = directSavings + (coupon?.totalDiscount ?? 0);

  return (
    <div className="space-y-6">
      {/* Cupón: un solo código para todo el carrito. Se aplica a los apuntes del vendedor
          que lo emitió; el resto queda igual. */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0f1e1a]">
        {coupon ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-400/12 dark:text-green-300">
                <Tag className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  {coupon.code} aplicado
                </p>
                <p className="text-xs text-muted-foreground">
                  Descuenta {formatArs(coupon.totalDiscount)} en{" "}
                  {Object.values(coupon.bySeller).reduce(
                    (n, s) => n + Object.keys(s.byResume).length,
                    0
                  )}{" "}
                  apunte
                  {Object.values(coupon.bySeller).reduce(
                    (n, s) => n + Object.keys(s.byResume).length,
                    0
                  ) === 1
                    ? ""
                    : "s"}{" "}
                  del carrito.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-white/5"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="cart-coupon"
              className="text-sm font-semibold text-foreground"
            >
              ¿Tenés un código de descuento?
            </label>
            <div className="flex gap-2">
              <input
                id="cart-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                placeholder="CÓDIGO"
                maxLength={20}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm uppercase tracking-wide outline-none transition-colors focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={validating || !couponCode.trim()}
                className="shrink-0 rounded-xl border border-accent-600 px-4 py-2 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-50 dark:border-accent-300/35 dark:text-accent-100 dark:hover:bg-accent-300/10"
              >
                {validating ? "Validando…" : "Aplicar"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se aplica solo a los apuntes del vendedor que lo emitió.
            </p>
            {couponError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {couponError}
              </p>
            )}
          </div>
        )}
      </section>

      {groups.map((group) => {
        const groupDirectSavings = group.entries.reduce(
          (s, e) => s + Math.max(0, e.listPrice - e.price),
          0
        );
        const groupCouponDiscount = couponDiscountForGroup(group);
        const groupSavings = groupDirectSavings + groupCouponDiscount;
        const total = groupTotal(group);
        const isFreeGroup = total === 0;

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
                const couponOff = couponDiscountFor(e);
                const finalPrice = Math.max(0, e.price - couponOff);
                return (
                  <li
                    key={e.cartId}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.type === "bundle" ? `Paquete: ${e.title}` : e.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {discounted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                            -{e.discountPercent}% aplicado
                          </span>
                        )}
                        {couponOff > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-400/12 dark:text-green-300">
                            <Tag className="h-3 w-3" strokeWidth={2} />
                            {coupon!.code} −{formatArs(couponOff)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <span className="text-sm font-semibold text-foreground">
                          {finalPrice === 0 ? "Gratis" : formatArs(finalPrice)}
                        </span>
                        {(discounted || couponOff > 0) && (
                          <span className="ml-1.5 text-xs text-gray-400 line-through">
                            {formatArs(couponOff > 0 ? e.price : e.listPrice)}
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
                <span className="text-xl font-bold tracking-tight text-foreground">
                  {isFreeGroup ? "Gratis" : formatArs(total)}
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
                  ? isFreeGroup
                    ? "Agregando…"
                    : "Redirigiendo…"
                  : isFreeGroup
                    ? "Obtener gratis"
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
