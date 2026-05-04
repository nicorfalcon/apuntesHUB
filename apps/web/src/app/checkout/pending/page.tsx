import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase_id?: string }>;
}) {
  const { purchase_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!purchase_id) redirect("/explorar");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Tu pago está pendiente</h1>
        <p className="text-sm text-gray-500">
          Mercado Pago está procesando tu pago. Esto puede tardar unos minutos.
          Una vez confirmado, el apunte aparecerá en tu biblioteca.
        </p>
        <Link
          href="/my-purchases"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          Ir a mi biblioteca
        </Link>
      </div>
    </div>
  );
}
