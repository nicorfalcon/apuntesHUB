import type { CourseModule, RecordedCourse } from "@/lib/database.types";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type CourseModuleWithVideo = Pick<
  CourseModule,
  | "id"
  | "position"
  | "title"
  | "description"
  | "duration_seconds"
  | "video_storage_key"
>;

export type CourseAccessCourse = Pick<
  RecordedCourse,
  "id" | "title" | "author_id" | "is_published"
>;

export type CourseModuleAccess = {
  course: CourseAccessCourse;
  modules: CourseModuleWithVideo[];
  module: CourseModuleWithVideo;
  isAuthor: boolean;
  enrollmentId: string | null;
};

export class CourseModuleAccessError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "not_found" | "forbidden",
    message: string
  ) {
    super(message);
    this.name = "CourseModuleAccessError";
  }
}

export async function assertCourseModuleAccess({
  supabase,
  userId,
  courseId,
  moduleId,
  requireEnrollment = false,
}: {
  supabase: SupabaseServerClient;
  userId: string | null | undefined;
  courseId: string;
  moduleId: string;
  requireEnrollment?: boolean;
}): Promise<CourseModuleAccess> {
  if (!userId) {
    throw new CourseModuleAccessError("unauthenticated", "No autorizado");
  }

  const { data: rawCourse } = await supabase
    .from("recorded_courses")
    .select(
      "id, title, author_id, is_published, course_modules(id, position, title, description, duration_seconds, video_storage_key)"
    )
    .eq("id", courseId)
    .is("deleted_at", null)
    .single();

  if (!rawCourse) {
    throw new CourseModuleAccessError("not_found", "Curso no encontrado");
  }

  const course = rawCourse as CourseAccessCourse & {
    course_modules: CourseModuleWithVideo[] | null;
  };
  const modules = [...(course.course_modules ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const currentModule = modules.find((candidate) => candidate.id === moduleId);

  if (!currentModule) {
    throw new CourseModuleAccessError("not_found", "Módulo no válido");
  }

  const isAuthor = userId === course.author_id;
  let enrollmentId: string | null = null;

  if (!isAuthor || requireEnrollment) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("course_id", courseId)
      .eq("student_id", userId)
      .eq("status", "completed")
      .maybeSingle();

    enrollmentId = enrollment?.id ?? null;
  }

  if ((!isAuthor && !enrollmentId) || (requireEnrollment && !enrollmentId)) {
    throw new CourseModuleAccessError("forbidden", "Sin inscripción");
  }

  return {
    course: {
      id: course.id,
      title: course.title,
      author_id: course.author_id,
      is_published: course.is_published,
    },
    modules,
    module: currentModule,
    isAuthor,
    enrollmentId,
  };
}
