"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OrderStatusPollerProps {
  orderId: string;
}

/**
 * Pollea el estado de la orden hasta que el webhook de MP la marca 'completed'.
 * Mientras tanto muestra "confirmando el pago". Al completarse, redirige a la
 * biblioteca donde ya aparecen los apuntes del pedido.
 */
export function OrderStatusPoller({ orderId }: OrderStatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === "completed") {
      const t = setTimeout(() => router.push("/my-purchases"), 1200);
      return () => clearTimeout(t);
    }
    if (status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
        }
      } catch {
        /* reintenta en el próximo tick */
      }
      setElapsed((e) => e + 1);
    }, 2500);

    return () => clearInterval(interval);
  }, [orderId, status, router]);

  if (status === "completed") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-400/15">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pago confirmado</h1>
        <p className="mt-2 text-sm text-gray-500">Te llevamos a tu biblioteca…</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">El pago no se completó</h1>
        <p className="mt-2 text-sm text-gray-500">
          No se realizó ningún cobro. Podés intentarlo de nuevo desde tu carrito.
        </p>
        <Link
          href="/carrito"
          className="mt-4 inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Volver al carrito
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <svg className="mx-auto mb-4 h-8 w-8 animate-spin text-accent-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Confirmando el pago…</h1>
      <p className="mt-2 text-sm text-gray-500">
        Esto puede tardar unos segundos.
        {elapsed > 8 && (
          <>
            {" "}
            Si ya pagaste, tus materiales aparecerán en{" "}
            <Link href="/my-purchases" className="text-accent-700 underline">
              tu biblioteca
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
