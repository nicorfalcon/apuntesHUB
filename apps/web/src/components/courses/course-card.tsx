import Link from "next/link";
import { Clock, PlayCircle } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import { formatArs, formatCourseType, formatDuration } from "./format";
import type { RecordedCourseItem } from "./types";

interface CourseCardProps {
  course: RecordedCourseItem;
}

function moduleCountLabel(count: number) {
  if (count === 1) return "1 módulo";
  return `${count} módulos`;
}

function CourseCover({ course }: { course: RecordedCourseItem }) {
  const backgroundColor = course.cover_color ?? "#263833";
  const hasImage = Boolean(course.cover_image_url);

  return (
    <div
      className="group/cover relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/15 text-white"
      style={{
        backgroundColor,
        backgroundImage: hasImage
          ? `linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.35) 55%, rgba(0,0,0,.7) 100%), url(${course.cover_image_url})`
          : "radial-gradient(circle at 18% 18%, rgba(255,255,255,.22), transparent 28%), radial-gradient(circle at 82% 24%, rgba(255,255,255,.12), transparent 22%), linear-gradient(135deg, rgba(255,255,255,.16) 0 1px, transparent 1px)",
        backgroundPosition: "center",
        backgroundSize: hasImage ? "cover" : "auto, auto, 28px 28px",
      }}
    >
      {!hasImage && (
        <div className="absolute bottom-5 right-5 hidden w-28 space-y-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:block">
          <span className="block h-1.5 rounded-full bg-white/60" />
          <span className="block h-1.5 w-2/3 rounded-full bg-white/35" />
          <span className="block h-1.5 w-5/6 rounded-full bg-white/25" />
        </div>
      )}

      {/* Tipo de curso */}
      <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
        {formatCourseType(course.course_type)}
      </span>

      {/* Duración */}
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
        <Clock className="h-3 w-3" strokeWidth={2} />
        {formatDuration(course.total_duration_seconds)}
      </span>

      {/* Botón de play */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur transition-transform duration-200 group-hover/cover:scale-110">
          <PlayCircle className="h-8 w-8" strokeWidth={1.6} />
        </span>
      </span>

      {/* Título sobre portadas generadas (sin imagen) */}
      {!hasImage && (
        <p className="absolute bottom-4 left-4 right-4 line-clamp-2 text-lg font-bold leading-tight text-white">
          {course.title}
        </p>
      )}
    </div>
  );
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <article className="group rounded-2xl border border-gray-200 bg-white p-2.5 transition-colors hover:border-accent-300 dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:border-accent-300/35">
      <CourseCover course={course} />
      <div className="p-2 pt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground/80">
            {course.subjects?.name ?? "Materia"}
          </span>
          <span className="shrink-0">
            {moduleCountLabel(course.course_modules.length)}
          </span>
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
