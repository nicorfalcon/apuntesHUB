import Link from "next/link";
import { BookOpen, Clock, PlayCircle } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import {
  formatArs,
  formatCourseType,
  formatDuration,
  shortCourseType,
} from "./format";
import type { RecordedCourseItem } from "./types";

interface CourseCardProps {
  course: RecordedCourseItem;
  featured?: boolean;
}

function moduleCountLabel(count: number) {
  if (count === 1) return "1 módulo";
  return `${count} módulos`;
}

function CourseCover({
  course,
  featured = false,
}: {
  course: RecordedCourseItem;
  featured?: boolean;
}) {
  const backgroundColor = course.cover_color ?? "#263833";
  const hasImage = Boolean(course.cover_image_url);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/15 text-white ${
        featured ? "min-h-[210px] md:min-h-[230px]" : "aspect-[1.65]"
      }`}
      style={{
        backgroundColor,
        backgroundImage: hasImage
          ? `linear-gradient(0deg, rgba(0,0,0,.48), rgba(0,0,0,.08)), url(${course.cover_image_url})`
          : "radial-gradient(circle at 18% 18%, rgba(255,255,255,.22), transparent 28%), radial-gradient(circle at 82% 24%, rgba(255,255,255,.12), transparent 22%), linear-gradient(135deg, rgba(255,255,255,.16) 0 1px, transparent 1px)",
        backgroundPosition: "center",
        backgroundSize: hasImage ? "cover" : "auto, auto, 28px 28px",
      }}
    >
      {!hasImage && (
        <>
          <div className="absolute right-5 top-5 h-16 w-16 rounded-2xl border border-white/15 bg-white/10" />
          <div className="absolute bottom-5 right-5 hidden w-28 space-y-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:block">
            <span className="block h-1.5 rounded-full bg-white/60" />
            <span className="block h-1.5 w-2/3 rounded-full bg-white/35" />
            <span className="block h-1.5 w-5/6 rounded-full bg-white/25" />
          </div>
        </>
      )}
      <div className="absolute left-4 top-4 rounded-full bg-white/14 px-2.5 py-1 text-xs font-bold backdrop-blur">
        {formatCourseType(course.course_type)}
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">
          {shortCourseType(course.course_type)}
        </p>
        {!hasImage && (
          <p
            className={`mt-2 line-clamp-2 max-w-md font-bold leading-tight text-white ${
              featured ? "text-2xl" : "text-lg"
            }`}
          >
            {course.title}
          </p>
        )}
        <p className="mt-2 max-w-xs text-sm leading-5 text-white/80">
          {course.subjects?.name ?? "Materia"} ·{" "}
          {formatDuration(course.total_duration_seconds)}
        </p>
      </div>
    </div>
  );
}

export function CourseCard({ course, featured = false }: CourseCardProps) {
  if (featured) {
    return (
      <article className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#0f1e1a] lg:grid-cols-[1fr_0.95fr]">
        <CourseCover course={course} featured />
        <div className="flex min-w-0 flex-col justify-between gap-4 p-1 lg:p-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
                Destacado
              </span>
              <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-white/5">
                {moduleCountLabel(course.course_modules.length)}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-bold leading-tight text-foreground md:text-3xl">
              {course.title}
            </h3>
            {course.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {course.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {course.subjects?.university ?? "Universidad"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(course.total_duration_seconds)}
              </span>
            </div>
            <div className="mt-3">
              <StarRating
                rating={course.rating_avg ?? 0}
                count={course.rating_count ?? 0}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">por</p>
              <p className="font-semibold text-foreground">
                {course.profiles?.display_name ?? "Autor"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xl font-bold text-foreground">
                ${formatArs(course.price_ars)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  ARS
                </span>
              </p>
              <Link
                href={`/cursos/${course.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
              >
                Ver curso
                <PlayCircle className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group rounded-2xl border border-gray-200 bg-white p-2.5 transition-colors hover:border-accent-300 dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:border-accent-300/35">
      <CourseCover course={course} />
      <div className="p-2 pt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{course.subjects?.university ?? "Universidad"}</span>
          <span>{moduleCountLabel(course.course_modules.length)}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-[2.75rem] text-base font-bold leading-[1.35] text-foreground">
          {course.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          por {course.profiles?.display_name ?? "Autor"}
        </p>
        <div className="mt-3">
          <StarRating rating={course.rating_avg ?? 0} count={course.rating_count ?? 0} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-white/10">
          <p className="text-lg font-bold text-foreground">
            ${formatArs(course.price_ars)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              ARS
            </span>
          </p>
          <Link
            href={`/cursos/${course.id}`}
            className="rounded-full border border-accent-200 px-3 py-2 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
          >
            Ver
          </Link>
        </div>
      </div>
    </article>
  );
}
