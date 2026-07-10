import Link from "next/link";

export default function OrderCheckoutFailurePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
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
    </div>
  );
}
