import Link from "next/link";
import { BookOpen, PlayCircle } from "lucide-react";
import {
  formatArs,
  formatCourseType,
  formatDuration,
} from "@/components/courses/format";

interface EnrolledCourseCardProps {
  enrollmentId: string;
  courseId: string;
  title: string;
  courseType: string;
  coverColor: string | null;
  coverImageUrl: string | null;
  university: string | null;
  amount: number;
  purchasedAt: string;
  totalDurationSeconds: number;
  watchedSeconds: number;
  firstModuleId: string | null;
}

export function EnrolledCourseCard({
  courseId,
  title,
  courseType,
  coverColor,
  coverImageUrl,
  university,
  amount,
  purchasedAt,
  totalDurationSeconds,
  watchedSeconds,
  firstModuleId,
}: EnrolledCourseCardProps) {
  const progressPct =
    totalDurationSeconds > 0
      ? Math.min(100, Math.round((watchedSeconds / totalDurationSeconds) * 100))
      : 0;
  const background = coverColor ?? "#263833";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:border-accent-300/25">
      <div
        className="relative h-32 w-full text-white"
        style={{
          backgroundColor: background,
          backgroundImage: coverImageUrl
            ? `linear-gradient(0deg, rgba(0,0,0,.45), rgba(0,0,0,.18)), url(${coverImageUrl})`
            : undefined,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
          {formatCourseType(courseType)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {title}
          </h3>
          {university && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {university}
            </p>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressPct}% visto</span>
            <span>{formatDuration(totalDurationSeconds)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent-600 dark:bg-accent-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-muted-foreground dark:border-white/10">
          <span>
            {new Date(purchasedAt).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="font-semibold text-foreground">
            ${formatArs(amount)} ARS
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={
              firstModuleId
                ? `/cursos/${courseId}/ver/${firstModuleId}`
                : `/cursos/${courseId}`
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
          >
            <PlayCircle className="h-4 w-4" />
            {progressPct > 0 ? "Continuar" : "Empezar"}
          </Link>
          <Link
            href={`/cursos/${courseId}`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
          >
            Ver curso
          </Link>
        </div>
      </div>
    </article>
  );
}
