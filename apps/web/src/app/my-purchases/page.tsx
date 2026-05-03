import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateFolderButton } from "./create-folder-button";
import { FolderCard } from "./folder-card";
import { PurchaseCard } from "./purchase-card";
import { EnrolledCourseCard } from "./enrolled-course-card";
import type { PurchaseWithResume, FolderWithItems } from "@/lib/database.types";
import Link from "next/link";

interface EnrolledCourseRow {
  id: string;
  course_id: string;
  amount: number;
  purchased_at: string;
  recorded_courses: {
    id: string;
    title: string;
    course_type: string;
    cover_color: string | null;
    cover_image_url: string | null;
    total_duration_seconds: number;
    subjects: { university: string | null } | null;
    course_modules: { id: string; position: number }[] | null;
  } | null;
  course_progress: { watched_seconds: number }[] | null;
}

export default async function MisApuntesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-purchases");

  const [{ data: purchases }, { data: folders }, { data: enrollmentsRaw }] = await Promise.all([
    supabase
      .from("purchases")
      .select("*, resumes(title, subject, university, preview_url, profiles!seller_id(display_name)), reviews(id)")
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase
      .from("folders")
      .select("*, folder_items(resume_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("course_enrollments")
      .select(
        "id, course_id, amount, purchased_at, recorded_courses!inner(id, title, course_type, cover_color, cover_image_url, total_duration_seconds, subjects(university), course_modules(id, position)), course_progress(watched_seconds)"
      )
      .eq("student_id", user.id)
      .eq("status", "completed")
      .order("purchased_at", { ascending: false }),
  ]);

  const list = (purchases as PurchaseWithResume[]) ?? [];
  const folderList = (folders as FolderWithItems[]) ?? [];
  const enrollments = (enrollmentsRaw as unknown as EnrolledCourseRow[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div>
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi biblioteca</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-sand-300/75">
            Apuntes que compraste y cursos a los que estás inscripto.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 space-y-12">
        {/* Carpetas (apuntes) */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Mis carpetas</h2>
            <CreateFolderButton />
          </div>
          {folderList.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center dark:border-white/15">
              <p className="text-sm text-gray-400 dark:text-sand-300/65">Creá carpetas para organizar tus apuntes por materia o tema.</p>
              <CreateFolderButton variant="ghost" className="mt-3" />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {folderList.map((folder) => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>
          )}
        </section>

        {/* Apuntes comprados */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Mis apuntes</h2>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-16 w-16 text-gray-200 dark:text-sand-300/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Todavía no compraste ningún apunte</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-sand-300/75">Explorá el marketplace y encontrá el material que necesitás para tus materias.</p>
              <Link href="/explorar" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700">
                Explorar apuntes
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((purchase) => (
                <PurchaseCard key={purchase.id} purchase={purchase} folders={folderList} />
              ))}
            </div>
          )}
        </section>

        {/* Cursos grabados inscriptos */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Mis cursos</h2>
          {enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-16 w-16 text-gray-200 dark:text-sand-300/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Todavía no estás inscripto en ningún curso</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-sand-300/75">Mirá los cursos grabados de profes acreditados.</p>
              <Link
                href="/explorar?tab=grabadas"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
              >
                Ver cursos
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => {
                const course = enrollment.recorded_courses;
                if (!course) return null;
                const watchedSeconds = (enrollment.course_progress ?? []).reduce(
                  (sum, p) => sum + (p.watched_seconds ?? 0),
                  0
                );
                const sortedModules = [...(course.course_modules ?? [])].sort(
                  (a, b) => a.position - b.position
                );
                return (
                  <EnrolledCourseCard
                    key={enrollment.id}
                    enrollmentId={enrollment.id}
                    courseId={course.id}
                    title={course.title}
                    courseType={course.course_type}
                    coverColor={course.cover_color}
                    coverImageUrl={course.cover_image_url}
                    university={course.subjects?.university ?? null}
                    amount={Number(enrollment.amount)}
                    purchasedAt={enrollment.purchased_at}
                    totalDurationSeconds={course.total_duration_seconds}
                    watchedSeconds={watchedSeconds}
                    firstModuleId={sortedModules[0]?.id ?? null}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
