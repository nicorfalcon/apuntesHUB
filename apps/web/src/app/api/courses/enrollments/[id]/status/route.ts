import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/courses/enrollments/[id]/status
 * Estado de una inscripción para polling desde la página de éxito del checkout.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: enrollment, error } = await supabase
    .from("course_enrollments")
    .select("status, course_id")
    .eq("id", id)
    .eq("student_id", user.id)
    .single();

  if (error || !enrollment) {
    return NextResponse.json(
      { error: "Inscripción no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: enrollment.status,
    course_id: enrollment.course_id,
  });
}
