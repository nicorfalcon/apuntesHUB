import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResumesList } from "./resumes-list";
import { CoursesList } from "./courses-list";
import { BookingsList } from "./bookings-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sell/dashboard");

  const admin = createAdminClient();

  const [
    { data: resumes },
    { data: purchases },
    { data: mpCreds },
    { data: courses },
    { data: enrollments },
    { data: bookings },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("seller_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
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
    supabase
      .from("recorded_courses")
      .select("id, title, price_ars, is_published, deleted_at, rating_avg, rating_count, created_at, course_modules(id, position, title, video_storage_key)")
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("course_enrollments")
      .select("course_id, amount, seller_amount, recorded_courses!inner(author_id)")
      .eq("recorded_courses.author_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("tutor_bookings")
      .select(
        "id, scheduled_at, duration_minutes, hourly_rate_ars, status, subjects(name), profiles!student_id(display_name)"
      )
      .eq("tutor_id", user.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("is_tutor, tutor_bio")
      .eq("id", user.id)
      .single(),
  ]);

  const hasMpConnected = !!mpCreds;

  // Stats: apuntes
  const totalApuntes = resumes?.length ?? 0;
  const totalVentasApuntes = purchases?.length ?? 0;
  const ingresosApuntes =
    purchases?.reduce((sum, p) => sum + Number(p.seller_amount), 0) ?? 0;

  const ventasPorResume: Record<string, number> = {};
  const ingresosPorResume: Record<string, number> = {};
  purchases?.forEach((p) => {
    ventasPorResume[p.resume_id] = (ventasPorResume[p.resume_id] ?? 0) + 1;
    ingresosPorResume[p.resume_id] =
      (ingresosPorResume[p.resume_id] ?? 0) + Number(p.seller_amount);
  });

  // Stats: cursos grabados
  const totalCursos = courses?.length ?? 0;
  const totalVentasCursos = enrollments?.length ?? 0;
  const ingresosCursos =
    enrollments?.reduce((sum, e) => sum + Number(e.seller_amount), 0) ?? 0;

  const ventasPorCurso: Record<string, number> = {};
  const ingresosPorCurso: Record<string, number> = {};
  enrollments?.forEach((e) => {
    ventasPorCurso[e.course_id] = (ventasPorCurso[e.course_id] ?? 0) + 1;
    ingresosPorCurso[e.course_id] =
      (ingresosPorCurso[e.course_id] ?? 0) + Number(e.seller_amount);
  });

  // Stats: tutorías
  const completedBookings =
    bookings?.filter((b) => b.status === "completed") ?? [];
  const totalTutorias = completedBookings.length;
  const ingresosTutorias = completedBookings.reduce(
    (sum, b) => sum + ((b.hourly_rate_ars ?? 0) * (b.duration_minutes ?? 60)) / 60,
    0
  );

  const isTutor = profile?.is_tutor ?? false;
  const showCoursesSection = totalCursos > 0;
  const showTutorSection = isTutor || (bookings?.length ?? 0) > 0;

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
              Tus apuntes, cursos y tutorías no podrán cobrarse hasta que configures Mercado Pago.
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

      {/* Stats apuntes */}
      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Apuntes
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Total apuntes" value={totalApuntes} />
          <StatCard label="Ventas" value={totalVentasApuntes} />
          <StatCard
            label="Ingresos"
            value={`$${ingresosApuntes.toLocaleString("es-AR")} ARS`}
            highlight
            hint="(90% de cada venta antes de la comisión MP)"
          />
        </div>
      </div>

      {/* Stats cursos grabados */}
      {showCoursesSection && (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cursos grabados
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Total cursos" value={totalCursos} />
            <StatCard label="Inscripciones" value={totalVentasCursos} />
            <StatCard
              label="Ingresos"
              value={`$${ingresosCursos.toLocaleString("es-AR")} ARS`}
              highlight
              hint="(90% de cada inscripción)"
            />
          </div>
        </div>
      )}

      {/* Stats tutorías */}
      {showTutorSection && (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Clases particulares
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              label="Estado"
              value={isTutor ? "Activo" : "Pausado"}
            />
            <StatCard label="Clases dictadas" value={totalTutorias} />
            <StatCard
              label="Ingresos"
              value={`$${Math.round(ingresosTutorias).toLocaleString("es-AR")} ARS`}
              highlight
              hint="Tarifa × duración de clases completadas"
            />
          </div>
        </div>
      )}

      {/* Lista de apuntes */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Mis apuntes</h2>
        <div className="mt-4">
          <ResumesList
            resumes={resumes ?? []}
            ventasPorResume={ventasPorResume}
            ingresosPorResume={ingresosPorResume}
          />
        </div>
      </div>

      {/* Lista de cursos grabados */}
      {showCoursesSection && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Mis cursos grabados</h2>
          <div className="mt-4">
            <CoursesList
              courses={courses ?? []}
              ventasPorCurso={ventasPorCurso}
              ingresosPorCurso={ingresosPorCurso}
            />
          </div>
        </div>
      )}

      {/* Lista de tutorías */}
      {showTutorSection && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Mis clases particulares</h2>
          <div className="mt-4">
            <BookingsList bookings={(bookings ?? []) as never} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  hint,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          highlight
            ? "text-accent-700 dark:text-accent-100"
            : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
