import Link from "next/link";
import { CourseVideoUpload } from "./course-video-upload";

type CourseRow = {
  id: string;
  title: string;
  price_ars: number;
  is_published: boolean;
  rating_avg: number;
  rating_count: number;
  course_modules:
    | {
        id: string;
        position: number;
        title: string;
        video_storage_key: string | null;
      }[]
    | null;
};

interface CoursesListProps {
  courses: CourseRow[];
  ventasPorCurso: Record<string, number>;
  ingresosPorCurso: Record<string, number>;
}

export function CoursesList({
  courses,
  ventasPorCurso,
  ingresosPorCurso,
}: CoursesListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-400">Todavía no creaste ningún curso grabado.</p>
        <Link
          href="/sell/new"
          className="mt-4 inline-block rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Crear mi primer curso
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {courses.map((course) => {
        const ventas = ventasPorCurso[course.id] ?? 0;
        const ingresos = ingresosPorCurso[course.id] ?? 0;
        const hasRating = (course.rating_count ?? 0) > 0;
        const modules = [...(course.course_modules ?? [])].sort(
          (a, b) => a.position - b.position
        );
        const missingVideoCount = modules.filter(
          (courseModule) => !courseModule.video_storage_key
        ).length;

        return (
          <div
            key={course.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      course.is_published
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {course.is_published ? "Publicado" : "Borrador"}
                  </span>
                  {missingVideoCount > 0 && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {missingVideoCount} video
                      {missingVideoCount === 1 ? "" : "s"} pendiente
                      {missingVideoCount === 1 ? "" : "s"}
                    </span>
                  )}
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {course.title}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {ventas} inscripci{ventas === 1 ? "ón" : "ones"}
                  {ingresos > 0 && (
                    <> · ${ingresos.toLocaleString("es-AR")}</>
                  )}
                  {hasRating && (
                    <>
                      {" · ★ "}
                      {Number(course.rating_avg).toFixed(1)} ({course.rating_count})
                    </>
                  )}
                </p>
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-accent-700">
                  ${Number(course.price_ars).toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            {modules.length > 0 && (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {modules.map((courseModule) => (
                  <CourseVideoUpload
                    key={courseModule.id}
                    courseId={course.id}
                    moduleId={courseModule.id}
                    hasVideo={Boolean(courseModule.video_storage_key)}
                    label={`${courseModule.position}. ${courseModule.title}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
