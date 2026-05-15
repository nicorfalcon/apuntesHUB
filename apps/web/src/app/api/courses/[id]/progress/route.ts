import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertCourseModuleAccess,
  CourseModuleAccessError,
} from "@/lib/courses/access";

/**
 * POST /api/courses/[id]/progress
 * Upsert del progreso de un módulo. Body: { module_id, watched_seconds, completed? }.
 * RLS de course_progress garantiza que el alumno solo modifica su propio enrollment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    module_id?: string;
    watched_seconds?: number;
    completed?: boolean;
  } | null;

  if (!body?.module_id) {
    return NextResponse.json({ error: "module_id requerido" }, { status: 400 });
  }

  const watched = Math.max(0, Math.floor(Number(body.watched_seconds ?? 0)));

  let access;
  try {
    access = await assertCourseModuleAccess({
      supabase,
      userId: user.id,
      courseId,
      moduleId: body.module_id,
      requireEnrollment: true,
    });
  } catch (error) {
    if (!(error instanceof CourseModuleAccessError)) throw error;
    const statusByCode = {
      unauthenticated: 401,
      forbidden: 403,
      not_found: 404,
    } as const;
    return NextResponse.json(
      { error: error.message },
      { status: statusByCode[error.code] }
    );
  }

  const { data: existingProgress } = await supabase
    .from("course_progress")
    .select("completed_at")
    .eq("enrollment_id", access.enrollmentId)
    .eq("module_id", body.module_id)
    .maybeSingle();

  const nextCompletedAt =
    body.completed ||
    (access.module.duration_seconds > 0 && watched >= access.module.duration_seconds - 5)
      ? new Date().toISOString()
      : existingProgress?.completed_at ?? null;

  const { error: upsertError } = await supabase
    .from("course_progress")
    .upsert(
      {
        enrollment_id: access.enrollmentId,
        module_id: body.module_id,
        watched_seconds: watched,
        completed_at: nextCompletedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,module_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, completed: Boolean(nextCompletedAt) });
}
