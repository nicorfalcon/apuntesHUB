"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AddToCartButtonProps {
  itemType: "resume" | "bundle";
  itemId: string;
  isLoggedIn: boolean;
  /** Si el comprador ya tiene el ítem en el carrito (estado inicial). */
  initiallyInCart?: boolean;
  redirectPath: string;
  className?: string;
}

/**
 * Agrega un apunte o paquete al carrito (tabla cart_items, vía RLS). Emite el evento
 * "cart-updated" para que el badge del navbar se actualice.
 */
export function AddToCartButton({
  itemType,
  itemId,
  isLoggedIn,
  initiallyInCart = false,
  redirectPath,
  className,
}: AddToCartButtonProps) {
  const router = useRouter();
  const [inCart, setInCart] = useState(initiallyInCart);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }
    if (inCart) {
      router.push("/carrito");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    const { error } = await supabase.from("cart_items").insert({
      buyer_id: user.id,
      item_type: itemType,
      resume_id: itemType === "resume" ? itemId : null,
      bundle_id: itemType === "bundle" ? itemId : null,
    });
    setLoading(false);

    if (error) {
      // 23505 = ya estaba en el carrito (unique parcial).
      if (error.code === "23505") {
        setInCart(true);
        return;
      }
      toast.error("No se pudo agregar al carrito.");
      return;
    }

    setInCart(true);
    window.dispatchEvent(new Event("cart-updated"));
    // Sin esto, /carrito se sirve desde el Router Cache y el ítem recién agregado no
    // aparece hasta un F5 (la página es un Server Component: no alcanza con el evento).
    router.refresh();
    toast.success("Agregado al carrito.");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={
        className ??
        "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent-600 py-2.5 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-60 dark:border-accent-300/35 dark:text-accent-100 dark:hover:bg-accent-300/10"
      }
    >
      {inCart ? (
        <>
          <Check className="h-4 w-4" />
          En el carrito · Ver
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" />
          Agregar al carrito
        </>
      )}
    </button>
  );
}
