import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
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

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("recorded_courses")
    .select("id, author_id, deleted_at, course_modules(id, video_storage_key)")
    .eq("id", courseId)
    .single();

  if (!course || course.author_id !== user.id) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (course.deleted_at) {
    return NextResponse.json(
      { error: "No podés publicar un curso eliminado." },
      { status: 400 }
    );
  }

  const modules = Array.isArray(course.course_modules)
    ? course.course_modules
    : [];

  if (modules.length === 0 || modules.some((module) => !module.video_storage_key)) {
    return NextResponse.json(
      { error: "Cada módulo necesita tener su video cargado." },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("recorded_courses")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) {
    return NextResponse.json(
      { error: "No pudimos publicar el curso." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
