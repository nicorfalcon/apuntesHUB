import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutFailurePage({
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

  // Obtener datos de la compra para el link de "intentar de nuevo"
  let resumeId: string | null = null;
  if (purchase_id) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("resume_id")
      .eq("id", purchase_id)
      .eq("buyer_id", user.id)
      .single();
    resumeId = purchase?.resume_id ?? null;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">El pago no se completó</h1>
        <p className="text-sm text-gray-500">
          Tu pago fue rechazado o cancelado. No se realizó ningún cargo.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          {resumeId && (
            <Link
              href={`/resume/${resumeId}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
            >
              Intentar de nuevo
            </Link>
          )}
          <Link
            href="/explorar"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Volver a explorar
          </Link>
        </div>
      </div>
    </div>
  );
}
