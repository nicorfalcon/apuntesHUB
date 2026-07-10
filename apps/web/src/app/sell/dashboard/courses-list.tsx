import Link from "next/link";
import { CourseCoverUpload } from "./course-cover-upload";
import { CourseVideoUpload } from "./course-video-upload";
import { CourseDiscountControl } from "./course-discount-control";

type CourseRow = {
  id: string;
  title: string;
  price_ars: number;
  discount_percent: number;
  is_published: boolean;
  cover_color: string | null;
  cover_image_url: string | null;
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
  userId: string;
  courses: CourseRow[];
  ventasPorCurso: Record<string, number>;
  ingresosPorCurso: Record<string, number>;
}

export function CoursesList({
  userId,
  courses,
  ventasPorCurso,
  ingresosPorCurso,
}: CoursesListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-400">Todavía no creaste ningún curso grabado.</p>
        <Link
          href="/sell/new?type=curso"
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
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="grid gap-0 lg:grid-cols-[204px_minmax(0,1fr)]">
              <div className="p-3 lg:border-r lg:border-gray-100 dark:lg:border-white/10">
                <CourseCoverUpload
                  courseId={course.id}
                  userId={userId}
                  title={course.title}
                  coverColor={course.cover_color}
                  coverImageUrl={course.cover_image_url}
                />
              </div>

              <div className="min-w-0 p-3 lg:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          course.is_published
                            ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                            : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-sand-200"
                        }`}
                      >
                        {course.is_published ? "Publicado" : "Borrador"}
                      </span>
                      {missingVideoCount > 0 && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-100">
                          {missingVideoCount} video
                          {missingVideoCount === 1 ? "" : "s"} pendiente
                          {missingVideoCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-base font-bold text-foreground">
                      {course.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {modules.length} módulo{modules.length === 1 ? "" : "s"} ·{" "}
                      {ventas} inscripci{ventas === 1 ? "ón" : "ones"}
                      {hasRating && (
                        <>
                          {" · "}
                          {Number(course.rating_avg).toFixed(1)} ({course.rating_count})
                        </>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:w-[240px]">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Precio
                      </p>
                      <p className="mt-1 text-sm font-bold text-accent-700 dark:text-accent-100">
                        ${Number(course.price_ars).toLocaleString("es-AR")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Ingresos
                      </p>
                      <p className="mt-1 text-sm font-bold text-foreground">
                        ${ingresos.toLocaleString("es-AR")}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <CourseDiscountControl
                        courseId={course.id}
                        priceArs={Number(course.price_ars)}
                        initialDiscount={Number(course.discount_percent ?? 0)}
                      />
                    </div>
                  </div>
                </div>

                {modules.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/10">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Videos del curso
                      </p>
                      {missingVideoCount === 0 ? (
                        <span className="text-xs font-bold text-green-700 dark:text-green-300">
                          Todo cargado
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-yellow-800 dark:text-yellow-100">
                          Faltan {missingVideoCount}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
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
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
