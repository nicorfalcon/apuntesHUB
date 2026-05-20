import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Layers,
  PlayCircle,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StarRating } from "@/components/ui/star-rating";
import { EnrollButton } from "@/components/courses/enroll-button";
import { CourseReviewsSection } from "@/components/courses/course-reviews-section";
import {
  formatArs,
  formatCourseType,
  formatDuration,
  shortCourseType,
} from "@/components/courses/format";
import type { RecordedCourseItem } from "@/components/courses/types";

function ModuleRow({
  module,
  locked,
  progressPct,
  completed,
}: {
  module: RecordedCourseItem["course_modules"][number];
  locked: boolean;
  progressPct: number;
  completed: boolean;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-sm font-bold text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
        {module.position}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-bold text-foreground">{module.title}</h3>
            {module.description && (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {module.description}
              </p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatDuration(module.duration_seconds)}
          </span>
        </div>
        {locked && (
          <p className="mt-3 text-xs text-muted-foreground">
            El video se desbloquea cuando se integra la inscripción del curso.
          </p>
        )}
        {!locked && progressPct > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>{completed ? "Completado" : "Progreso"}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent-600 dark:bg-accent-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type CourseProgressRow = {
  module_id: string;
  watched_seconds: number;
  completed_at: string | null;
  updated_at: string | null;
};

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawCourse } = await supabase
    .from("recorded_courses")
    .select(
      "*, profiles!author_id(id, display_name, avatar_url, university, career), subjects(id, name, university, career), course_modules(id, position, title, description, duration_seconds)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!rawCourse) notFound();

  const course = {
    ...(rawCourse as RecordedCourseItem),
    course_modules: [
      ...(((rawCourse as RecordedCourseItem).course_modules ?? []) as RecordedCourseItem["course_modules"]),
    ].sort((a, b) => a.position - b.position),
  };
  const isAuthor = user?.id === course.author_id;

  if (!course.is_published && !isAuthor) notFound();

  const { data: enrollment } = user
    ? await supabase
        .from("course_enrollments")
        .select("id, status")
        .eq("course_id", course.id)
        .eq("student_id", user.id)
        .in("status", ["completed", "pending"])
        .maybeSingle()
    : { data: null };

  const hasAccess = isAuthor || enrollment?.status === "completed";
  const firstModule = course.course_modules[0];
  const coverColor = course.cover_color ?? "#263833";

  // Progreso del alumno: solo se calcula si hay enrollment completed
  let watchedSeconds = 0;
  let progressRows: CourseProgressRow[] = [];
  if (enrollment?.status === "completed") {
    const { data } = await supabase
      .from("course_progress")
      .select("module_id, watched_seconds, completed_at, updated_at")
      .eq("enrollment_id", enrollment.id);
    progressRows = (data ?? []) as CourseProgressRow[];
    const modulesById = new Map(
      course.course_modules.map((courseModule) => [courseModule.id, courseModule])
    );
    watchedSeconds = progressRows.reduce((sum, row) => {
      const courseModule = modulesById.get(row.module_id);
      if (row.completed_at && courseModule) {
        return sum + courseModule.duration_seconds;
      }
      const watched = row.watched_seconds ?? 0;
      return sum + Math.min(watched, courseModule?.duration_seconds ?? watched);
    }, 0);
  }
  const progressPct =
    course.total_duration_seconds > 0
      ? Math.min(
          100,
          Math.round((watchedSeconds / course.total_duration_seconds) * 100)
        )
      : 0;

  const progressByModule = new Map(
    progressRows.map((row) => [row.module_id, row])
  );
  const getModuleProgressPct = (
    courseModule: RecordedCourseItem["course_modules"][number]
  ) => {
    const row = progressByModule.get(courseModule.id);
    if (!row) return 0;
    if (row.completed_at) return 100;
    if (courseModule.duration_seconds <= 0) return 0;
    return Math.min(
      100,
      Math.round(((row.watched_seconds ?? 0) / courseModule.duration_seconds) * 100)
    );
  };
  const latestProgress = [...progressRows].sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  })[0];
  const latestModuleIndex = latestProgress
    ? course.course_modules.findIndex(
        (courseModule) => courseModule.id === latestProgress.module_id
      )
    : -1;
  const continueModule =
    latestModuleIndex >= 0
      ? latestProgress.completed_at && course.course_modules[latestModuleIndex + 1]
        ? course.course_modules[latestModuleIndex + 1]
        : course.course_modules[latestModuleIndex]
      : firstModule;

  // Reseñas: lectura pública. Detectamos si el usuario ya dejó una.
  const { data: reviewRows } = await supabase
    .from("course_reviews")
    .select(
      "id, rating, comment, created_at, reviewer_id, profiles:reviewer_id(display_name, avatar_url)"
    )
    .eq("course_id", course.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const admin = createAdminClient();
  const [{ count: privateQuestionCount }, { count: answeredQuestionCount }] =
    await Promise.all([
      admin
        .from("material_questions")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "course")
        .eq("course_id", course.id)
        .neq("status", "hidden"),
      admin
        .from("material_questions")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "course")
        .eq("course_id", course.id)
        .in("status", ["answered", "resolved"]),
    ]);

  type ReviewRow = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer_id: string;
    profiles:
      | { display_name: string | null; avatar_url: string | null }
      | { display_name: string | null; avatar_url: string | null }[]
      | null;
  };

  const reviews = ((reviewRows as unknown as ReviewRow[]) ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles;
    return {
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
      reviewer_id: row.reviewer_id,
      profiles: profile,
    };
  });

  const hasExistingReview = user
    ? reviews.some((review) => review.reviewer_id === user.id)
    : false;
  const reviewableEnrollmentId =
    enrollment?.status === "completed" && !isAuthor ? enrollment.id : null;

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/explorar?tab=grabadas"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Cursos grabados
          </Link>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <header className="overflow-hidden rounded-[28px] border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0f1e1a]">
              <div
                className="relative min-h-[300px] border-b border-gray-200 p-6 text-white dark:border-white/10"
                style={{
                  backgroundColor: coverColor,
                  backgroundImage: course.cover_image_url
                    ? `linear-gradient(0deg, rgba(0,0,0,.48), rgba(0,0,0,.18)), url(${course.cover_image_url})`
                    : undefined,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                    {formatCourseType(course.course_type)}
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                    {course.course_modules.length} módulo
                    {course.course_modules.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="font-display text-6xl italic leading-none text-white/90 md:text-7xl">
                    {shortCourseType(course.course_type)}
                  </p>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm font-semibold text-accent-700 dark:text-accent-100">
                  {course.subjects?.name ?? "Materia"}
                </p>
                <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-foreground md:text-5xl">
                  {course.title}
                </h1>
                {course.description && (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                    {course.description}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    {course.subjects?.university ?? "Universidad"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="h-4 w-4" />
                    {course.course_modules.length} módulo
                    {course.course_modules.length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatDuration(course.total_duration_seconds)}
                  </span>
                </div>
              </div>
            </header>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-foreground">Módulos</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDuration(course.total_duration_seconds)}
                </p>
              </div>
              {course.course_modules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="font-bold text-foreground">
                    Este curso todavía no tiene módulos publicados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {course.course_modules.map((module) => (
                    <ModuleRow
                      key={module.id}
                      module={module}
                      locked={!hasAccess}
                      progressPct={getModuleProgressPct(module)}
                      completed={Boolean(progressByModule.get(module.id)?.completed_at)}
                    />
                  ))}
                </div>
              )}
            </section>

            <CourseReviewsSection
              courseId={course.id}
              reviews={reviews}
              reviewableEnrollmentId={reviewableEnrollmentId}
              hasExistingReview={hasExistingReview}
            />
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-[28px] border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    Precio
                  </p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    ${formatArs(course.price_ars)}
                  </p>
                  <p className="text-sm text-muted-foreground">ARS</p>
                </div>
                <StarRating
                  rating={course.rating_avg ?? 0}
                  count={course.rating_count ?? 0}
                />
              </div>

              <div className="mt-6 border-t border-gray-100 pt-5 dark:border-white/10">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Autor
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">
                      {course.profiles?.display_name ?? "Autor"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[course.profiles?.university, course.profiles?.career]
                        .filter(Boolean)
                        .join(" · ") || "apuntesHUB"}
                    </p>
                  </div>
                </div>
              </div>

              {((privateQuestionCount ?? 0) > 0 || (answeredQuestionCount ?? 0) > 0) && (
                <div className="mt-6 space-y-2 border-t border-gray-100 pt-5 text-sm dark:border-white/10">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Consultas privadas</span>
                    <span className="text-right font-semibold text-foreground">
                      Incluye {privateQuestionCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Respondidas</span>
                    <span className="text-right font-semibold text-foreground">
                      {answeredQuestionCount ?? 0} por el autor
                    </span>
                  </div>
                </div>
              )}

              {enrollment?.status === "completed" && !isAuthor && (
                <div className="mt-6 border-t border-gray-100 pt-5 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-muted-foreground">
                    <span>Tu progreso</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-accent-600 dark:bg-accent-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-gray-100 pt-5 dark:border-white/10">
                {isAuthor ? (
                  <Link
                    href="/sell/new?type=curso"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent-200 px-4 py-3 text-sm font-bold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
                  >
                    Crear otro curso
                  </Link>
                ) : hasAccess && continueModule ? (
                  <Link
                    href={`/cursos/${course.id}/ver/${continueModule.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                  >
                    {progressPct > 0 ? "Continuar curso" : "Ver curso"}
                    <PlayCircle className="h-4 w-4" />
                  </Link>
                ) : (
                  <EnrollButton
                    courseId={course.id}
                    isAuthenticated={Boolean(user)}
                  />
                )}
                <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                  Pagás una vez y mantenés acceso permanente a los videos del curso.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
