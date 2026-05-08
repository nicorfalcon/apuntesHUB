"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Library,
  PlayCircle,
  Plus,
  WalletCards,
} from "lucide-react";

type DashboardTab = "apuntes" | "cursos" | "clases";

function normalizeDashboardTab(value: string | null): DashboardTab | null {
  if (value === "apuntes" || value === "cursos" || value === "clases") {
    return value;
  }
  return null;
}

interface SellerDashboardWorkspaceProps {
  hasMpConnected: boolean;
  showTutorSection: boolean;
  isTutor: boolean;
  totalApuntes: number;
  totalCursos: number;
  totalVentasApuntes: number;
  totalVentasCursos: number;
  totalTutorias: number;
  ingresosApuntes: number;
  ingresosCursos: number;
  ingresosTutorias: number;
  apuntesContent: ReactNode;
  cursosContent: ReactNode;
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")} ARS`;
}

function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Library;
  label: string;
  value: string | number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            accent
              ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
              : "bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  detail,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  detail: string;
  icon: typeof Library;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[210px] flex-1 items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-accent-300 dark:focus-visible:ring-offset-[#071713] ${
        active
          ? "border-accent-300 bg-accent-50 dark:border-accent-300/35 dark:bg-accent-300/10"
          : "border-gray-200 bg-white hover:border-accent-200 hover:bg-accent-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/30 dark:hover:bg-accent-300/10"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          active
            ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
            : "bg-gray-50 text-accent-700 dark:bg-white/[0.04] dark:text-accent-100"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{label}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-accent-700 ring-1 ring-gray-200 dark:bg-[#071713] dark:text-accent-100 dark:ring-white/10">
            {count}
          </span>
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}

export function SellerDashboardWorkspace({
  hasMpConnected,
  showTutorSection,
  isTutor,
  totalApuntes,
  totalCursos,
  totalVentasApuntes,
  totalVentasCursos,
  totalTutorias,
  ingresosApuntes,
  ingresosCursos,
  ingresosTutorias,
  apuntesContent,
  cursosContent,
}: SellerDashboardWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab: DashboardTab =
    totalApuntes > 0 || totalCursos === 0 ? "apuntes" : "cursos";
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    () => {
      const tabFromUrl = normalizeDashboardTab(searchParams.get("inventario"));
      if (tabFromUrl === "clases" && !showTutorSection) return defaultTab;
      return tabFromUrl ?? defaultTab;
    }
  );

  useEffect(() => {
    const tabFromUrl = normalizeDashboardTab(searchParams.get("inventario"));
    if (tabFromUrl && (tabFromUrl !== "clases" || showTutorSection)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, showTutorSection]);

  function selectTab(tab: DashboardTab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("inventario", tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }


  const totalPublicaciones = totalApuntes + totalCursos;
  const totalOperaciones = totalVentasApuntes + totalVentasCursos + totalTutorias;
  const ingresosTotales = ingresosApuntes + ingresosCursos + ingresosTutorias;
  const activeContent =
    activeTab === "apuntes"
      ? apuntesContent
      : activeTab === "cursos"
        ? cursosContent
        : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
            Ventas
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Panel de ventas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ingresos, publicaciones y entregables organizados por inventario.
          </p>
        </div>
        <Link
          href="/sell/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          <Plus className="h-4 w-4" />
          Nueva publicación
        </Link>
      </header>

      {!hasMpConnected && (
        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-400/25 dark:bg-yellow-400/10">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700 dark:bg-yellow-300/15 dark:text-yellow-100">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-bold text-yellow-900 dark:text-yellow-100">
              Conectá Mercado Pago para recibir pagos
            </p>
            <p className="mt-1 text-xs leading-5 text-yellow-800 dark:text-yellow-100/75">
              Tus apuntes, cursos y tutorías no podrán cobrarse hasta que lo
              configures.
            </p>
            <Link
              href="/profile"
              className="mt-2 inline-block text-xs font-bold text-yellow-900 underline hover:text-yellow-950 dark:text-yellow-100 dark:hover:text-white"
            >
              Ir a mi perfil
            </Link>
          </div>
        </div>
      )}

      <section className="mt-7 grid gap-3 md:grid-cols-4" aria-label="Resumen">
        <MetricTile
          icon={WalletCards}
          label="Ingresos"
          value={formatMoney(ingresosTotales)}
          hint="Total estimado de ventas completadas."
          accent
        />
        <MetricTile
          icon={Library}
          label="Publicaciones"
          value={totalPublicaciones}
          hint={`${totalApuntes} apuntes y ${totalCursos} cursos.`}
        />
        <MetricTile
          icon={BookOpen}
          label="Ventas"
          value={totalOperaciones}
          hint={`${totalVentasApuntes} apuntes, ${totalVentasCursos} cursos${
            showTutorSection ? `, ${totalTutorias} clases` : ""
          }.`}
        />
        <MetricTile
          icon={GraduationCap}
          label="Tutorías"
          value={showTutorSection ? (isTutor ? "Activo" : "Pausado") : "Sin perfil"}
          hint={
            showTutorSection
              ? `${totalTutorias} clases completadas.`
              : "Activá clases si querés vender horas."
          }
        />
      </section>

      <section className="mt-10" aria-labelledby="inventory-title">
        <div className="mb-5 flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-white/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="inventory-title" className="text-lg font-bold text-foreground">
                Inventario
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cambiá de categoría sin scrollear por listas completas.
              </p>
            </div>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex gap-3">
              <TabButton
                active={activeTab === "apuntes"}
                label="Apuntes"
                count={totalApuntes}
                detail={`${totalVentasApuntes} venta${
                  totalVentasApuntes === 1 ? "" : "s"
                }`}
                icon={BookOpen}
                onClick={() => selectTab("apuntes")}
              />
              <TabButton
                active={activeTab === "cursos"}
                label="Cursos grabados"
                count={totalCursos}
                detail={`${totalVentasCursos} inscripción${
                  totalVentasCursos === 1 ? "" : "es"
                }`}
                icon={PlayCircle}
                onClick={() => selectTab("cursos")}
              />
              {showTutorSection && (
                <TabButton
                  active={activeTab === "clases"}
                  label="Clases"
                  count={totalTutorias}
                  detail={isTutor ? "Perfil activo" : "Perfil pausado"}
                  icon={GraduationCap}
                  onClick={() => selectTab("clases")}
                />
              )}
            </div>
          </div>
        </div>

        {activeTab === "clases" && (
          <div className="rounded-2xl border border-accent-200 bg-accent-50/70 p-6 dark:border-accent-300/20 dark:bg-accent-300/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  La gestión de clases ahora se realiza desde tu Perfil de profesor.
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Vender queda enfocado en apuntes y cursos. Para administrar materias,
                  horarios, bloqueos y reservas, usá la sección docente de tu perfil.
                </p>
              </div>
              <Link
                href="/profile/profesor"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
              >
                Ir a Perfil de profesor
              </Link>
            </div>
          </div>
        )}
        {activeContent}
      </section>
    </div>
  );
}
