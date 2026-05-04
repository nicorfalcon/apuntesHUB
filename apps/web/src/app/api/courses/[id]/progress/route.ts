import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Verificar enrollment activo del alumno para este curso
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("student_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "Sin inscripción" }, { status: 403 });
  }

  // Verificar que el módulo pertenezca al curso
  const { data: courseModule } = await supabase
    .from("course_modules")
    .select("id, duration_seconds")
    .eq("id", body.module_id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!courseModule) {
    return NextResponse.json({ error: "Módulo no válido" }, { status: 404 });
  }

  const completedAt =
    body.completed || (courseModule.duration_seconds > 0 && watched >= courseModule.duration_seconds - 5)
      ? new Date().toISOString()
      : null;

  const { error: upsertError } = await supabase
    .from("course_progress")
    .upsert(
      {
        enrollment_id: enrollment.id,
        module_id: body.module_id,
        watched_seconds: watched,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,module_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, completed: Boolean(completedAt) });
}
