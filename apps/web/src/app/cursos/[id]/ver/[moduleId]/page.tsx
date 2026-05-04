import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoursePlayer } from "@/components/courses/course-player";
import { createCourseVideoReadUrl } from "@/lib/backblaze/client";
import type { CourseModuleSummary } from "@/components/courses/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id: courseId, moduleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/cursos/${courseId}`);
  }

  // 1. Curso + módulos
  const { data: rawCourse } = await supabase
    .from("recorded_courses")
    .select(
      "id, title, author_id, is_published, deleted_at, course_modules(id, position, title, description, duration_seconds, video_storage_key)"
    )
    .eq("id", courseId)
    .is("deleted_at", null)
    .single();

  if (!rawCourse) notFound();

  const course = rawCourse as {
    id: string;
    title: string;
    author_id: string;
    is_published: boolean;
    course_modules: CourseModuleSummary[] | null;
  };

  const isAuthor = user.id === course.author_id;

  // 2. Inscripción completada del alumno (autor también pasa, para previsualizar)
  let hasAccess = isAuthor;
  let enrollmentId: string | null = null;

  if (!isAuthor) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, status")
      .eq("course_id", courseId)
      .eq("student_id", user.id)
      .eq("status", "completed")
      .maybeSingle();

    if (enrollment) {
      hasAccess = true;
      enrollmentId = enrollment.id;
    }
  }

  if (!hasAccess) {
    // Sin enrollment ni autoría: 403 (renderizamos notFound como 404 amigable).
    redirect(`/cursos/${courseId}`);
  }

  const modules = [...(course.course_modules ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const currentModule = modules.find((m) => m.id === moduleId);

  if (!currentModule) notFound();

  // 3. Progreso previo (solo aplica si hay enrollment del alumno)
  let initialWatchedSeconds = 0;
  let moduleProgress: Record<string, { watchedSeconds: number; completed: boolean }> = {};
  if (enrollmentId) {
    const { data: progressRows } = await supabase
      .from("course_progress")
      .select("module_id, watched_seconds, completed_at")
      .eq("enrollment_id", enrollmentId)
      .in(
        "module_id",
        modules.map((courseModule) => courseModule.id)
      );

    moduleProgress = Object.fromEntries(
      (progressRows ?? []).map((progress) => [
        progress.module_id,
        {
          watchedSeconds: progress.watched_seconds ?? 0,
          completed: Boolean(progress.completed_at),
        },
      ])
    );
    initialWatchedSeconds = moduleProgress[moduleId]?.watchedSeconds ?? 0;
  }

  // Watermark: usamos el email del usuario (lo que tenemos en sesión).
  const watermarkEmail = user.email ?? "";
  const videoSrc = currentModule.video_storage_key
    ? await createCourseVideoReadUrl(currentModule.video_storage_key)
    : null;

  return (
    <CoursePlayer
      courseId={course.id}
      courseTitle={course.title}
      modules={modules}
      currentModuleId={currentModule.id}
      initialWatchedSeconds={initialWatchedSeconds}
      videoSrc={videoSrc}
      watermarkEmail={watermarkEmail}
      moduleProgress={moduleProgress}
      isAuthorPreview={isAuthor && !enrollmentId}
    />
  );
}
