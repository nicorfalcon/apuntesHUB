"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PurchaseButtonProps {
  resumeId: string;
  isLoggedIn: boolean;
  sellerHasMp: boolean;
  hasPendingPurchase: boolean;
}

export function PurchaseButton({
  resumeId,
  isLoggedIn,
  sellerHasMp,
  hasPendingPurchase,
}: PurchaseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/resume/${resumeId}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/mercadopago/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar la compra");
        setLoading(false);
        return;
      }

      // Redirigir directo al Checkout Pro de Mercado Pago
      if (data.initPoint) {
        window.location.href = data.initPoint;
        return; // Mantener loading=true mientras redirige
      }

      // Fallback por si no viene initPoint
      setError("Error al obtener el enlace de pago.");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    }

    setLoading(false);
  }

  // Vendedor sin MP conectado
  if (!sellerHasMp) {
    return (
      <div className="mt-4 rounded-xl bg-amber-50/60 border border-amber-200/60 px-4 py-3">
        <p className="text-xs text-amber-700">
          Este apunte no está disponible para compra aún. El vendedor no tiene
          configurado su método de pago.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2.5">
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="w-full rounded-xl bg-accent-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Redirigiendo a Mercado Pago…
          </span>
        ) : !isLoggedIn ? (
          "Iniciar sesión para comprar"
        ) : hasPendingPurchase ? (
          "Continuar con el pago"
        ) : (
          "Comprar apunte"
        )}
      </button>

      {/* Texto de seguridad */}
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
        <svg
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
            clipRule="evenodd"
          />
        </svg>
        Pagá de forma segura con Mercado Pago
      </p>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
