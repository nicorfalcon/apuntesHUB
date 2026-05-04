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

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/15 text-white ${
        featured ? "min-h-[280px]" : "aspect-[1.45]"
      }`}
      style={{
        backgroundColor,
        backgroundImage: course.cover_image_url
          ? `linear-gradient(0deg, rgba(0,0,0,.42), rgba(0,0,0,.14)), url(${course.cover_image_url})`
          : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute left-4 top-4 rounded-full bg-white/14 px-3 py-1 text-xs font-bold backdrop-blur">
        {formatCourseType(course.course_type)}
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <p className="font-display text-5xl italic leading-none text-white/90">
          {shortCourseType(course.course_type)}
        </p>
        <p className="mt-3 max-w-xs text-sm leading-5 text-white/80">
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
      <article className="grid gap-5 rounded-[28px] border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f1e1a] lg:grid-cols-[1.15fr_0.85fr]">
        <CourseCover course={course} featured />
        <div className="flex min-w-0 flex-col justify-between gap-6 p-2 lg:p-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
                Destacado
              </span>
              <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-white/5">
                {moduleCountLabel(course.course_modules.length)}
              </span>
            </div>
            <h3 className="mt-5 text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {course.title}
            </h3>
            {course.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {course.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {course.subjects?.university ?? "Universidad"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(course.total_duration_seconds)}
              </span>
            </div>
            <div className="mt-4">
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
              <p className="text-2xl font-bold text-foreground">
                ${formatArs(course.price_ars)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  ARS
                </span>
              </p>
              <Link
                href={`/cursos/${course.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
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
    <article className="group rounded-2xl border border-gray-200 bg-white p-3 transition-colors hover:border-accent-300 dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:border-accent-300/35">
      <CourseCover course={course} />
      <div className="p-2 pt-4">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{course.subjects?.university ?? "Universidad"}</span>
          <span>{moduleCountLabel(course.course_modules.length)}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-[3rem] text-lg font-bold leading-6 text-foreground">
          {course.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          por {course.profiles?.display_name ?? "Autor"}
        </p>
        <div className="mt-3">
          <StarRating rating={course.rating_avg ?? 0} count={course.rating_count ?? 0} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
          <p className="text-xl font-bold text-foreground">
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
