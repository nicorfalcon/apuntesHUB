"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface BundleBuyButtonProps {
  bundleId: string;
  sellerId: string;
  isLoggedIn: boolean;
}

/**
 * "Comprar ahora" un paquete: crea una orden de un solo ítem (tipo bundle) y
 * redirige a Mercado Pago. Reusa /api/orders/checkout.
 */
export function BundleBuyButton({
  bundleId,
  sellerId,
  isLoggedIn,
}: BundleBuyButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/bundles/${bundleId}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          items: [{ type: "bundle", id: bundleId }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      const target = data.redirectUrl ?? data.initPoint;
      if (target) {
        window.location.href = target;
        return;
      }
      toast.error("No se obtuvo el enlace de pago.");
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.");
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleBuy}
      disabled={loading}
      className="w-full rounded-xl bg-accent-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md disabled:opacity-60"
    >
      {loading ? "Redirigiendo a Mercado Pago…" : "Comprar paquete"}
    </button>
  );
}
