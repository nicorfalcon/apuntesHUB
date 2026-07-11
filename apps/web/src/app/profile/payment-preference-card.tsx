"use client";

import { useState } from "react";
import { toast } from "sonner";

type Provider = "mercadopago" | "paypal";

interface PaymentPreferenceCardProps {
  initialPreferred: Provider | null;
}

const OPTIONS: { value: Provider; label: string; hint: string }[] = [
  { value: "mercadopago", label: "Mercado Pago", hint: "Recomendado para Argentina" },
  { value: "paypal", label: "PayPal", hint: "Recomendado para el exterior" },
];

/**
 * Se muestra solo cuando el vendedor tiene MP y PayPal conectados a la vez.
 * Permite elegir con cuál cobra por defecto (persiste profiles.preferred_payment_provider).
 */
export function PaymentPreferenceCard({
  initialPreferred,
}: PaymentPreferenceCardProps) {
  // Si nunca eligió, el default efectivo del backend es Mercado Pago.
  const [preferred, setPreferred] = useState<Provider>(
    initialPreferred ?? "mercadopago"
  );
  const [saving, setSaving] = useState(false);

  async function choose(next: Provider) {
    if (next === preferred) return;
    const prev = preferred;
    setPreferred(next);
    setSaving(true);
    const res = await fetch("/api/seller/payment-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: next }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(
        `Tus productos se cobrarán con ${next === "paypal" ? "PayPal" : "Mercado Pago"}.`
      );
    } else {
      setPreferred(prev);
      toast.error("No se pudo guardar la preferencia.");
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
      <h3 className="text-base font-semibold text-foreground">
        ¿Con cuál cobrás por defecto?
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-sand-300/75">
        Tenés Mercado Pago y PayPal conectados. Elegí con cuál se cobran tus
        productos.
      </p>

      <div
        role="radiogroup"
        aria-label="Proveedor de cobro por defecto"
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((opt) => {
          const active = preferred === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => choose(opt.value)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-60 ${
                active
                  ? "border-accent-500 bg-accent-50 ring-1 ring-accent-500/40 dark:border-accent-300/50 dark:bg-accent-300/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-white/25"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-sand-300/70">
                  {opt.hint}
                </span>
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active
                    ? "border-accent-500 bg-accent-500"
                    : "border-gray-300 dark:border-white/25"
                }`}
              >
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
