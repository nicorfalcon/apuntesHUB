"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  FolderOpen,
  Library,
  PlayCircle,
} from "lucide-react";
import { CreateFolderButton } from "./create-folder-button";
import { EnrolledCourseCard } from "./enrolled-course-card";
import { FolderCard } from "./folder-card";
import { PurchaseCard } from "./purchase-card";
import type { FolderWithItems, PurchaseWithResume } from "@/lib/database.types";

export interface EnrolledCourseRow {
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
    course_modules: { id: string; position: number; duration_seconds: number }[] | null;
  } | null;
  course_progress:
    | {
        module_id: string;
        watched_seconds: number;
        completed_at: string | null;
        updated_at: string | null;
      }[]
    | null;
}

interface LibraryWorkspaceProps {
  purchases: PurchaseWithResume[];
  folders: FolderWithItems[];
  enrollments: EnrolledCourseRow[];
}

type LibraryView = "apuntes" | "cursos";

function normalizeLibraryView(value: string | null): LibraryView | null {
  return value === "apuntes" || value === "cursos" ? value : null;
}

function StatTile({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          active
            ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
            : "bg-white text-accent-700 ring-1 ring-gray-200 dark:bg-white/[0.04] dark:text-accent-100 dark:ring-white/10"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-accent-300 dark:focus-visible:ring-offset-[#071713] ${
          active
            ? "border-accent-300 bg-accent-50 dark:border-accent-300/35 dark:bg-accent-300/10"
            : "border-gray-200 bg-white hover:border-accent-200 hover:bg-accent-50/55 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/30 dark:hover:bg-accent-300/10"
        }`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      {content}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-white/15">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
        <Icon className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
      >
        {action}
      </Link>
    </div>
  );
}

export function LibraryWorkspace({
  purchases,
  folders,
  enrollments,
}: LibraryWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultView: LibraryView =
    purchases.length > 0 || enrollments.length === 0 ? "apuntes" : "cursos";
  const [activeView, setActiveView] = useState<LibraryView>(
    () => normalizeLibraryView(searchParams.get("vista")) ?? defaultView
  );

  useEffect(() => {
    const viewFromUrl = normalizeLibraryView(searchParams.get("vista"));
    if (viewFromUrl) setActiveView(viewFromUrl);
  }, [searchParams]);

  function selectView(view: LibraryView) {
    setActiveView(view);
    const next = new URLSearchParams(searchParams.toString());
    next.set("vista", view);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeCount = activeView === "apuntes" ? purchases.length : enrollments.length;

  function getContinueModuleId(enrollment: EnrolledCourseRow) {
    const course = enrollment.recorded_courses;
    if (!course) return null;

    const modules = [...(course.course_modules ?? [])].sort(
      (a, b) => a.position - b.position
    );
    if (modules.length === 0) return null;

    const progressRows = [...(enrollment.course_progress ?? [])].filter(
      (progress) => progress.watched_seconds > 0 || progress.completed_at
    );
    if (progressRows.length === 0) return modules[0]?.id ?? null;

    const latestProgress = progressRows.sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    })[0];
    const latestIndex = modules.findIndex(
      (courseModule) => courseModule.id === latestProgress.module_id
    );

    if (latestIndex === -1) return modules[0]?.id ?? null;
    if (latestProgress.completed_at && modules[latestIndex + 1]) {
      return modules[latestIndex + 1].id;
    }

    return modules[latestIndex].id;
  }

  function getEffectiveWatchedSeconds(enrollment: EnrolledCourseRow) {
    const course = enrollment.recorded_courses;
    if (!course) return 0;

    const modulesById = new Map(
      (course.course_modules ?? []).map((courseModule) => [
        courseModule.id,
        courseModule,
      ])
    );

    return (enrollment.course_progress ?? []).reduce((sum, progress) => {
      const courseModule = modulesById.get(progress.module_id);
      if (progress.completed_at && courseModule) {
        return sum + courseModule.duration_seconds;
      }
      const watchedSeconds = progress.watched_seconds ?? 0;
      return sum + Math.min(watchedSeconds, courseModule?.duration_seconds ?? watchedSeconds);
    }, 0);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-[#0b1512]/80">
        <div className="mx-auto max-w-6xl px-4 py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
                Biblioteca
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Mi biblioteca
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Apuntes comprados, cursos activos y carpetas de estudio en una
                sola superficie.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/explorar"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent-200 hover:bg-accent-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10"
              >
                Explorar apuntes
              </Link>
              <Link
                href="/explorar?tab=grabadas"
                className="inline-flex items-center justify-center rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
              >
                Ver cursos
              </Link>
            </div>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <StatTile
              icon={BookOpen}
              label="Apuntes"
              value={purchases.length}
              active={activeView === "apuntes"}
              onClick={() => selectView("apuntes")}
            />
            <StatTile
              icon={PlayCircle}
              label="Cursos"
              value={enrollments.length}
              active={activeView === "cursos"}
              onClick={() => selectView("cursos")}
            />
            <StatTile icon={FolderOpen} label="Carpetas" value={folders.length} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-9 px-4 py-8">
        <section aria-labelledby="folders-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="folders-title" className="text-lg font-bold text-foreground">
                Carpetas
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Una tira rápida para ordenar apuntes sin empujar los cursos al
                fondo de la página.
              </p>
            </div>
            <CreateFolderButton />
          </div>

          {folders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-6 dark:border-white/15">
              <p className="text-sm text-muted-foreground">
                Creá carpetas para agrupar parciales, finales o materias.
              </p>
              <CreateFolderButton variant="ghost" className="mt-3" />
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 pb-2">
              <div className="flex gap-4">
                {folders.map((folder) => (
                  <div key={folder.id} className="w-[220px] shrink-0">
                    <FolderCard folder={folder} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="library-content-title">
          <div className="mb-5 flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2
                id="library-content-title"
                className="text-lg font-bold text-foreground"
              >
                Material de estudio
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeCount === 0
                  ? "Elegí una categoría para empezar."
                  : `${activeCount} ${
                      activeView === "apuntes" ? "apunte" : "curso"
                    }${activeCount === 1 ? "" : "s"} en esta vista.`}
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
              {(["apuntes", "cursos"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => selectView(view)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                    activeView === view
                      ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                      : "text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:hover:bg-white/[0.05]"
                  }`}
                >
                  {view === "apuntes" ? "Apuntes" : "Cursos"}
                </button>
              ))}
            </div>
          </div>

          {activeView === "apuntes" ? (
            purchases.length === 0 ? (
              <EmptyState
                icon={Library}
                title="Todavía no compraste ningún apunte"
                description="Explorá el marketplace y guardá el material que necesitás para tus materias."
                href="/explorar"
                action="Explorar apuntes"
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {purchases.map((purchase) => (
                  <PurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    folders={folders}
                  />
                ))}
              </div>
            )
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={PlayCircle}
              title="Todavía no estás inscripto en ningún curso"
              description="Mirá cursos grabados de profes acreditados y dejalos listos para estudiar cuando quieras."
              href="/explorar?tab=grabadas"
              action="Ver cursos"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {enrollments.map((enrollment) => {
                const course = enrollment.recorded_courses;
                if (!course) return null;
                const watchedSeconds = getEffectiveWatchedSeconds(enrollment);

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
                    firstModuleId={getContinueModuleId(enrollment)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
