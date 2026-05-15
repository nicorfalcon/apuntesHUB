import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoursePlayer } from "@/components/courses/course-player";
import type { CourseModuleSummary } from "@/components/courses/types";
import { createCourseVideoReadUrl } from "@/lib/backblaze/client";
import {
  assertCourseModuleAccess,
  CourseModuleAccessError,
} from "@/lib/courses/access";
import { getModuleHlsStatus } from "@/lib/courses/hls";

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

  const access = await assertCourseModuleAccess({
    supabase,
    userId: user.id,
    courseId,
    moduleId,
  }).catch((error) => {
    if (!(error instanceof CourseModuleAccessError)) throw error;
    if (error.code === "not_found") notFound();
    redirect(`/cursos/${courseId}`);
  });

  const { course, modules, module: currentModule, isAuthor, enrollmentId } = access;

  // Progreso previo (solo aplica si hay enrollment del alumno)
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
  const hlsStatus = await getModuleHlsStatus(currentModule.id);
  // Compradores/alumnos no reciben MP4 mientras el HLS se está procesando.
  // Autores/admins sí pueden seguir viendo MP4 para revisión/debug.
  const blockMp4ForProcessing =
    hlsStatus.hasPendingOrProcessingHlsAsset &&
    !hlsStatus.hasActiveHlsAsset &&
    !isAuthor;
  const hlsSrc = hlsStatus.hasActiveHlsAsset
    ? `/api/courses/${course.id}/modules/${currentModule.id}/hls/playlist`
    : null;
  const canUseMp4Source =
    !hlsStatus.hasActiveHlsAsset && !blockMp4ForProcessing;
  const mp4Src = canUseMp4Source && currentModule.video_storage_key
    ? await createCourseVideoReadUrl(currentModule.video_storage_key)
    : null;
  // Con HLS activo, el fallback/refresh MP4 queda restringido a autores/admins
  // (el endpoint también valida esto en server). Sin HLS, cualquier usuario con
  // acceso puede refrescar la signed URL si la inicial expira, salvo que el
  // asset esté pending/processing (en ese caso solo el autor refresca).
  const allowMp4Fallback = blockMp4ForProcessing
    ? false
    : hlsStatus.hasActiveHlsAsset
      ? isAuthor
      : true;
  const mp4FallbackUrlEndpoint =
    currentModule.video_storage_key && allowMp4Fallback
      ? `/api/courses/${course.id}/modules/${currentModule.id}/video-url`
      : null;
  const playbackType = hlsSrc ? "hls" : "mp4";
  const videoUnavailableMessage = blockMp4ForProcessing
    ? "El video se está procesando, intentá nuevamente en unos minutos."
    : null;
  const playerModules: CourseModuleSummary[] = modules.map((courseModule) => ({
    id: courseModule.id,
    position: courseModule.position,
    title: courseModule.title,
    description: courseModule.description,
    duration_seconds: courseModule.duration_seconds,
  }));

  return (
    <CoursePlayer
      courseId={course.id}
      courseTitle={course.title}
      modules={playerModules}
      currentModuleId={currentModule.id}
      initialWatchedSeconds={initialWatchedSeconds}
      playbackType={playbackType}
      hlsSrc={hlsSrc}
      mp4Src={mp4Src}
      mp4FallbackUrlEndpoint={mp4FallbackUrlEndpoint}
      allowMp4Fallback={allowMp4Fallback}
      watermarkEmail={watermarkEmail}
      moduleProgress={moduleProgress}
      isAuthorPreview={isAuthor && !enrollmentId}
      videoUnavailableMessage={videoUnavailableMessage}
    />
  );
}
