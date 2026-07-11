"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PAYPAL_CURRENCIES } from "@/lib/paypal/currencies";

interface PaypalConnectSectionProps {
  hasPaypalConnected: boolean;
  connectedAt: string | null;
  payoutCurrency: string;
  paymentsReceivable: boolean;
  onboardUrl: string;
}

function PayPalLogo({ className }: { className?: string }) {
  // Logo oficial simplificado en SVG (evita depender de assets externos).
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#003087"
        d="M7.4 21.5H4.6a.6.6 0 0 1-.6-.7L6.3 5.4a.9.9 0 0 1 .9-.8h6c2.7 0 4.7 1.9 4.2 4.7-.5 3.1-3 4.6-6 4.6H9.2a.6.6 0 0 0-.6.5l-.6 6.4a.6.6 0 0 1-.6.7Z"
      />
      <path
        fill="#0070E0"
        d="M18.9 8.1c-.5 3.1-3 4.6-6 4.6h-1.6a.9.9 0 0 0-.9.8l-.8 5.1-.2 1.4a.6.6 0 0 1-.6.5H6.3a.5.5 0 0 1-.5-.6l.3-1.7a.6.6 0 0 1 .6-.5h1.6c3 0 5.5-1.5 6-4.6.2-1 .1-1.9-.3-2.6.9.4 1.5 1.2 1.6 2.2Z"
      />
    </svg>
  );
}

export function PaypalConnectSection({
  hasPaypalConnected,
  connectedAt,
  payoutCurrency,
  paymentsReceivable,
  onboardUrl,
}: PaypalConnectSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(hasPaypalConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [currency, setCurrency] = useState(payoutCurrency);
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => {
    const paypal = searchParams.get("paypal");
    const reason = searchParams.get("reason");

    if (paypal === "connected") {
      setConnected(true);
      toast.success("¡PayPal conectado exitosamente!");
    } else if (paypal === "error") {
      const messages: Record<string, string> = {
        not_granted: "No se otorgaron los permisos necesarios.",
        onboard_init: "No se pudo iniciar la conexión con PayPal.",
        save_credentials: "Error al guardar las credenciales.",
      };
      toast.error(messages[reason ?? ""] ?? "Error al conectar PayPal.");
    }

    if (paypal) {
      const url = new URL(window.location.href);
      url.searchParams.delete("paypal");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  async function handleCurrencyChange(next: string) {
    const prev = currency;
    setCurrency(next);
    setSavingCurrency(true);
    const res = await fetch("/api/seller/payment-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: next }),
    });
    setSavingCurrency(false);
    if (res.ok) {
      toast.success(`Cobrás en ${next}.`);
    } else {
      setCurrency(prev);
      toast.error("No se pudo cambiar la moneda.");
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "¿Estás seguro? Tus productos no podrán cobrarse por PayPal hasta que reconectes."
      )
    ) {
      return;
    }
    setDisconnecting(true);
    const res = await fetch("/api/paypal/disconnect", { method: "POST" });
    if (res.ok) {
      setConnected(false);
      toast.success("PayPal desconectado.");
      router.refresh();
    } else {
      toast.error("No se pudo desconectar PayPal.");
    }
    setDisconnecting(false);
  }

  const formattedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:shadow-black/30">
      {/* Header con gradiente azul PayPal */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-[#EAF3FB] to-white px-6 py-5 dark:from-[#10233a] dark:to-[#0f1e1a]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <PayPalLogo className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">PayPal</h3>
          <p className="text-sm text-gray-500 dark:text-sand-300/75">
            Ideal para cobrar desde fuera de Argentina (México y más).
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-white/10" />

      <div className="px-6 py-5">
        {connected ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3.5 py-1.5 dark:border-emerald-300/25 dark:bg-emerald-400/10">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                  </span>
                  <span className="text-sm font-semibold text-green-700 dark:text-emerald-200">
                    Conectada
                  </span>
                </div>
                {formattedDate && (
                  <>
                    <span className="text-gray-300 dark:text-sand-300/35">·</span>
                    <span className="text-xs text-gray-400 dark:text-sand-300/70">
                      Desde {formattedDate}
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50 dark:text-sand-300/65 dark:hover:text-red-300"
              >
                {disconnecting ? "Desconectando…" : "Desconectar"}
              </button>
            </div>

            {/* Aviso si la cuenta todavía no puede recibir pagos */}
            {!paymentsReceivable && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 dark:border-amber-300/25 dark:bg-amber-300/10">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-amber-800 dark:text-amber-100">
                  Tu cuenta PayPal todavía no está habilitada para recibir pagos.
                  Confirmá tu email y datos en PayPal para activarla.
                </p>
              </div>
            )}

            {/* Selector de moneda de payout */}
            <div>
              <label
                htmlFor="paypal-currency"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Moneda en la que cobrás
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="paypal-currency"
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  disabled={savingCurrency}
                  className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.03]"
                >
                  {PAYPAL_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {savingCurrency && (
                  <span className="text-xs text-gray-400">Guardando…</span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-sand-300/70">
                PayPal no procesa pesos argentinos. Revisá que los precios de tus
                productos estén cargados en esta moneda.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-sand-300/75">
              Conectá tu cuenta PayPal Business para recibir los pagos de tus
              productos y que la plataforma retenga su comisión automáticamente.
            </p>
            <a
              href={onboardUrl}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#0070E0] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0059b3] hover:shadow-md"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                <PayPalLogo className="h-3.5 w-3.5" />
              </span>
              Conectar con PayPal
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
