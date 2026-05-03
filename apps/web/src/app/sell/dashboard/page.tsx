import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResumesList } from "./resumes-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sell/dashboard");

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("seller_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const admin = createAdminClient();
  const [{ data: purchases }, { data: mpCreds }] = await Promise.all([
    supabase
      .from("purchases")
      .select("amount, seller_amount, resume_id")
      .eq("seller_id", user.id)
      .eq("status", "completed"),
    admin
      .from("seller_mp_credentials")
      .select("id")
      .eq("id", user.id)
      .single(),
  ]);
  const hasMpConnected = !!mpCreds;

  const totalApuntes = resumes?.length ?? 0;
  const totalVentas = purchases?.length ?? 0;
  const totalIngresos = purchases?.reduce((sum, p) => sum + Number(p.seller_amount), 0) ?? 0;

  const ventasPorResume: Record<string, number> = {};
  const ingresosPorResume: Record<string, number> = {};
  purchases?.forEach((p) => {
    ventasPorResume[p.resume_id] = (ventasPorResume[p.resume_id] ?? 0) + 1;
    ingresosPorResume[p.resume_id] =
      (ingresosPorResume[p.resume_id] ?? 0) + Number(p.seller_amount);
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Panel de ventas
        </h1>
        <Link
          href="/sell/new"
          className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          + Nueva publicación
        </Link>
      </div>

      {/* Banner MP */}
      {!hasMpConnected && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-400/25 dark:bg-yellow-400/10">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-100">
              Conectá tu cuenta de Mercado Pago para recibir pagos
            </p>
            <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-100/75">
              Tus apuntes no podrán comprarse hasta que configures Mercado Pago.
            </p>
            <Link
              href="/profile"
              className="mt-2 inline-block text-xs font-semibold text-yellow-800 underline hover:text-yellow-900 dark:text-yellow-100 dark:hover:text-white"
            >
              Ir a mi perfil para conectar
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm text-muted-foreground">Total apuntes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalApuntes}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm text-muted-foreground">Ventas totales</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalVentas}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03] sm:col-span-1">
          <p className="text-sm text-muted-foreground">Tus ingresos</p>
          <p className="mt-1 text-2xl font-bold text-accent-700 dark:text-accent-100">
            ${totalIngresos.toLocaleString("es-AR")} ARS
          </p>
          <p className="text-xs text-muted-foreground">
            (90% de cada venta antes de la comisión de Mercado Pago)
          </p>
        </div>
      </div>

      {/* Lista de apuntes */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Mis apuntes</h2>
        <div className="mt-4">
          <ResumesList
            resumes={resumes ?? []}
            ventasPorResume={ventasPorResume}
            ingresosPorResume={ingresosPorResume}
          />
        </div>
      </div>
    </div>
  );
}
