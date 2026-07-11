"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PurchaseButtonProps {
  resumeId: string;
  isLoggedIn: boolean;
  sellerHasMp: boolean;
  hasPendingPurchase: boolean;
  /** El apunte es gratis (precio efectivo 0): sin cupón, sin línea de pago. */
  isFree?: boolean;
}

interface CouponResult {
  valid: boolean;
  error?: string;
  code?: string;
  discount_amount?: number;
  original_amount?: number;
  final_amount?: number;
}

export function PurchaseButton({
  resumeId,
  isLoggedIn,
  sellerHasMp,
  hasPendingPurchase,
  isFree = false,
}: PurchaseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cupón
  const [couponCode, setCouponCode] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [coupon, setCoupon] = useState<CouponResult | null>(null);

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) return;

    if (!isLoggedIn) {
      router.push(`/login?redirect=/resume/${resumeId}`);
      return;
    }

    setValidating(true);
    setCoupon(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, resumeId }),
      });
      const data = (await res.json()) as CouponResult;
      setCoupon(data);
    } catch {
      setCoupon({ valid: false, error: "No se pudo validar el código" });
    }
    setValidating(false);
  }

  function handleRemoveCoupon() {
    setCoupon(null);
    setCouponCode("");
  }

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
        body: JSON.stringify({
          resumeId,
          // Solo mandamos el código si validó OK; el server lo re-valida igual.
          ...(coupon?.valid ? { couponCode: coupon.code } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar la compra");
        setLoading(false);
        return;
      }

      const target = data.redirectUrl ?? data.initPoint;
      if (target) {
        window.location.href = target;
        return; // Mantener loading=true mientras redirige
      }

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
      {/* Cupón de descuento — no aplica a apuntes gratis */}
      {isLoggedIn && !isFree && (
        <div className="text-sm">
          {!couponOpen && !coupon?.valid ? (
            <button
              type="button"
              onClick={() => setCouponOpen(true)}
              className="text-xs font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-100"
            >
              ¿Tenés un código de descuento?
            </button>
          ) : coupon?.valid ? (
            <div className="flex items-center justify-between rounded-xl border border-green-200/70 bg-green-50/60 px-3 py-2 dark:border-green-400/25 dark:bg-green-400/10">
              <div className="text-xs">
                <span className="font-semibold text-green-700 dark:text-green-300">
                  {coupon.code}
                </span>{" "}
                <span className="text-green-700/80 dark:text-green-300/80">
                  aplicado (−$
                  {Number(coupon.discount_amount ?? 0).toLocaleString("es-AR")})
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Quitar
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  placeholder="CÓDIGO"
                  maxLength={20}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs uppercase tracking-wide outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={validating || !couponCode.trim()}
                  className="shrink-0 rounded-lg border border-accent-600 px-3 py-2 text-xs font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-50 dark:border-accent-300/35 dark:text-accent-100 dark:hover:bg-accent-300/10"
                >
                  {validating ? "…" : "Aplicar"}
                </button>
              </div>
              {coupon && !coupon.valid && (
                <p className="text-xs text-red-600">{coupon.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {coupon?.valid && (
        <p className="text-right text-sm font-semibold text-foreground">
          Total: ${Number(coupon.final_amount ?? 0).toLocaleString("es-AR")}{" "}
          <span className="text-xs font-normal text-gray-400 line-through">
            ${Number(coupon.original_amount ?? 0).toLocaleString("es-AR")}
          </span>
        </p>
      )}

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
          isFree ? "Iniciar sesión para obtenerlo" : "Iniciar sesión para comprar"
        ) : hasPendingPurchase ? (
          "Continuar con el pago"
        ) : isFree ? (
          "Obtener gratis"
        ) : (
          "Comprar apunte"
        )}
      </button>

      {/* Texto de seguridad — solo cuando hay un pago real de por medio */}
      {!isFree && (
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
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
