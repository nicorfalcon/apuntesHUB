import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteResumeButton } from "./delete-resume-button";

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

  // Ventas e ingresos totales
  const { data: purchases } = await supabase
    .from("purchases")
    .select("amount, seller_amount, resume_id")
    .eq("seller_id", user.id)
    .eq("status", "completed");

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
          {/* TODO: Actualizar cuando se active la comisión */}
          <p className="text-xs text-gray-400">(100% de cada venta)</p>
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
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-accent-700">
                      ${Number(resume.price).toLocaleString("es-AR")}
                    </span>
                    <Link
                      href={`/sell/${resume.id}/edit`}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Editar
                    </Link>
                    <DeleteResumeButton resumeId={resume.id} />
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
