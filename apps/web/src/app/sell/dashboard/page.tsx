import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResumesList } from "./resumes-list";
import { CoursesList } from "./courses-list";
import { BookingsList } from "./bookings-list";
import { SellerDashboardWorkspace } from "./seller-dashboard-workspace";

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
    { data: ingestionJobs },
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
    admin
      .from("recorded_courses")
      .select("id, title, price_ars, is_published, deleted_at, rating_avg, rating_count, created_at, cover_color, cover_image_url, course_modules(id, position, title, video_storage_key)")
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
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
    supabase
      .from("ingestion_jobs")
      .select("resume_id, status, chunks_generated"),
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

  const ingestionStatuses: Record<string, "pending" | "processing" | "done" | "failed"> = {};
  ingestionJobs?.forEach((j) => {
    ingestionStatuses[j.resume_id] = j.status;
  });

  const isTutor = profile?.is_tutor ?? false;
  const showTutorSection = isTutor || (bookings?.length ?? 0) > 0;

  return (
    <SellerDashboardWorkspace
      hasMpConnected={hasMpConnected}
      showTutorSection={showTutorSection}
      isTutor={isTutor}
      totalApuntes={totalApuntes}
      totalCursos={totalCursos}
      totalVentasApuntes={totalVentasApuntes}
      totalVentasCursos={totalVentasCursos}
      totalTutorias={totalTutorias}
      ingresosApuntes={ingresosApuntes}
      ingresosCursos={ingresosCursos}
      ingresosTutorias={ingresosTutorias}
      apuntesContent={
        <ResumesList
          resumes={resumes ?? []}
          ventasPorResume={ventasPorResume}
          ingresosPorResume={ingresosPorResume}
          ingestionStatuses={ingestionStatuses}
        />
      }
      cursosContent={
        <CoursesList
          userId={user.id}
          courses={courses ?? []}
          ventasPorCurso={ventasPorCurso}
          ingresosPorCurso={ingresosPorCurso}
        />
      }
      clasesContent={
        showTutorSection ? (
          <BookingsList bookings={(bookings ?? []) as never} />
        ) : undefined
      }
    />
  );
}
