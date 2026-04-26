import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResumeActionsMenu } from "./resume-actions-menu";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  published: { label: "Publicado", class: "bg-green-100 text-green-700" },
  draft: { label: "Borrador", class: "bg-gray-100 text-gray-600" },
  archived: { label: "Archivado", class: "bg-yellow-100 text-yellow-700" },
};

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
    .order("created_at", { ascending: false });

  // Ventas e ingresos totales + estado de MP
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

  const totalVentas = purchases?.length ?? 0;
  const totalIngresos = purchases?.reduce((sum, p) => sum + Number(p.seller_amount), 0) ?? 0;

  const ventasPorResume = new Map<string, number>();
  purchases?.forEach((p) => {
    ventasPorResume.set(p.resume_id, (ventasPorResume.get(p.resume_id) ?? 0) + 1);
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Panel de ventas
        </h1>
        <Link
          href="/sell/new"
          className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          + Publicar apunte
        </Link>
      </div>

      {/* Banner MP no conectado */}
      {!hasMpConnected && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Conectá tu cuenta de Mercado Pago para recibir pagos
            </p>
            <p className="mt-0.5 text-xs text-yellow-700">
              Tus apuntes no podrán comprarse hasta que configures Mercado Pago.
            </p>
            <Link
              href="/profile"
              className="mt-2 inline-block text-xs font-semibold text-yellow-800 underline hover:text-yellow-900"
            >
              Ir a mi perfil para conectar
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total apuntes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{resumes?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Ventas totales</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalVentas}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 col-span-2 sm:col-span-1">
          <p className="text-sm text-gray-500">Ingresos netos</p>
          <p className="mt-1 text-2xl font-bold text-accent-700">
            ${totalIngresos.toLocaleString("es-AR")} ARS
          </p>
          <p className="text-xs text-gray-400">(80% de cada venta - 20% comisión plataforma)</p>
        </div>
      </div>

      {/* Lista de apuntes */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Mis apuntes</h2>
        {!resumes || resumes.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-gray-400">Todavía no publicaste ningún apunte.</p>
            <Link
              href="/sell/new"
              className="mt-4 inline-block rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
            >
              Publicar mi primer apunte
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {resumes.map((resume) => {
              const statusInfo = STATUS_LABELS[resume.status] ?? STATUS_LABELS.draft;
              const ventas = ventasPorResume.get(resume.id) ?? 0;
              return (
                <div
                  key={resume.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {resume.title}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {resume.subject} · {resume.university} · {ventas} venta{ventas !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-accent-700">
                      ${Number(resume.price).toLocaleString("es-AR")}
                    </span>
                    <ResumeActionsMenu resumeId={resume.id} resumeTitle={resume.title} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
