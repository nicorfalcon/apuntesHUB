"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface MpConnectSectionProps {
  hasMpConnected: boolean;
  connectedAt: string | null;
  oauthUrl: string;
}

function MercadoPagoLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo-MP.jpg"
      alt="Mercado Pago"
      width={900}
      height={900}
      className={className}
      sizes="44px"
      priority={false}
    />
  );
}

function MercadoPagoLogoSmall() {
  return (
    <span className="flex h-5 w-5 overflow-hidden rounded-full bg-white">
      <Image
        src="/images/logo-MP.jpg"
        alt=""
        width={900}
        height={900}
        className="h-full w-full object-cover"
        sizes="20px"
      />
    </span>
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
        <MercadoPagoLogo className="h-11 w-11 shrink-0 rounded-xl object-cover drop-shadow-sm" />
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
              <MercadoPagoLogoSmall />
              Conectar con Mercado Pago
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
