"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface MpConnectSectionProps {
  hasMpConnected: boolean;
  connectedAt: string | null;
  oauthUrl: string;
}

// Logo oficial de Mercado Pago (isologotipo manos)
function MercadoPagoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#009EE3" />
      <g transform="translate(10, 14) scale(0.68)">
        <path
          d="M32 8C22.6 8 14.5 13.4 10.8 21.2c-1.2 2.6.8 5.2 3.6 5.2h3.2c1.8 0 3.4-1 4.2-2.6C24 19.4 27.8 17 32 17s8 2.4 10.2 6.8c.8 1.6 2.4 2.6 4.2 2.6h3.2c2.8 0 4.8-2.6 3.6-5.2C49.5 13.4 41.4 8 32 8z"
          fill="white"
        />
        <path
          d="M47.2 28H16.8c-2.2 0-4 1.8-4 4v12c0 6.6 5.4 12 12 12h14.4c6.6 0 12-5.4 12-12V32c0-2.2-1.8-4-4-4zM28 46c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v2zm0-10c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v2zm12 10c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v2zm0-10c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v2z"
          fill="white"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

// Logo MP pequeño para botón
function MercadoPagoLogoSmall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="none">
      <circle cx="12" cy="12" r="12" fill="white" fillOpacity="0.2" />
      <path
        d="M12 5C9.2 5 6.8 6.8 5.8 9.4c-.4.8.2 1.7 1.1 1.7h1c.6 0 1.1-.3 1.3-.8C10 8.8 10.9 8 12 8s2 .8 2.8 2.3c.2.5.7.8 1.3.8h1c.9 0 1.5-.9 1.1-1.7C17.2 6.8 14.8 5 12 5z"
        fill="white"
      />
      <path
        d="M17.1 12H6.9c-.7 0-1.3.6-1.3 1.3v3.8c0 2.1 1.7 3.9 3.9 3.9h5c2.1 0 3.9-1.7 3.9-3.9v-3.8c-.1-.7-.6-1.3-1.3-1.3z"
        fill="white"
        opacity="0.85"
      />
    </svg>
  );
}

export function MpConnectSection({
  hasMpConnected,
  connectedAt,
  oauthUrl,
}: MpConnectSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [connected, setConnected] = useState(hasMpConnected);

  // Mostrar toast según el resultado del OAuth redirect
  useEffect(() => {
    const mp = searchParams.get("mp");
    const reason = searchParams.get("reason");

    if (mp === "connected") {
      setConnected(true);
      toast.success("¡Mercado Pago conectado exitosamente!");
      // Limpiar el query param de la URL
      const url = new URL(window.location.href);
      url.searchParams.delete("mp");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    } else if (mp === "error") {
      const messages: Record<string, string> = {
        no_code: "No se recibió el código de autorización.",
        token_exchange: "Error al conectar con Mercado Pago.",
        save_credentials: "Error al guardar las credenciales.",
      };
      toast.error(messages[reason ?? ""] ?? "Error al conectar Mercado Pago.");
      const url = new URL(window.location.href);
      url.searchParams.delete("mp");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  async function handleDisconnect() {
    if (
      !confirm(
        "¿Estás seguro? Tus apuntes no podrán comprarse hasta que reconectes Mercado Pago."
      )
    ) {
      return;
    }

    setDisconnecting(true);

    const res = await fetch("/api/mercadopago/disconnect", { method: "POST" });

    if (res.ok) {
      setConnected(false);
      toast.success("Mercado Pago desconectado.");
      router.refresh();
    } else {
      toast.error("No se pudo desconectar Mercado Pago.");
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
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Header con gradiente celeste sutil */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-[#E8F6FD] to-white px-6 py-5">
        <MercadoPagoLogo className="h-11 w-11 shrink-0 drop-shadow-sm" />
        <div>
          <h3 className="text-base font-semibold text-foreground">Mercado Pago</h3>
          <p className="text-sm text-gray-500">
            Conectá tu cuenta para recibir los pagos de tus apuntes.
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-gray-100" />

      {/* Body */}
      <div className="px-6 py-5">
        {connected ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Badge conectado - pill style con dot animado */}
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3.5 py-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-semibold text-green-700">Conectada</span>
              </div>
              {formattedDate && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">Desde {formattedDate}</span>
                </>
              )}
            </div>

            {/* Botón desconectar - discreto */}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs font-medium text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
            >
              {disconnecting ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
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
                  Desconectando…
                </span>
              ) : (
                "Desconectar"
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 px-4 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-amber-800">
                Sin Mercado Pago conectado, los compradores no podrán adquirir tus apuntes.
              </p>
            </div>
            <a
              href={oauthUrl}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#009EE3] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#007BB8] hover:shadow-md"
            >
              <MercadoPagoLogoSmall className="h-5 w-5" />
              Conectar con Mercado Pago
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
