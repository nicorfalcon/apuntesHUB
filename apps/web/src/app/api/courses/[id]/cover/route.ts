import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
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

  const body = (await request.json().catch(() => null)) as
    | { cover_image_url?: string | null; cover_color?: string | null }
    | null;

  if (!body) {
    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
  }

  const coverImageUrl =
    body.cover_image_url === null ? null : normalizeText(body.cover_image_url);
  const coverColor =
    body.cover_color === undefined || body.cover_color === null
      ? undefined
      : normalizeText(body.cover_color);

  if (typeof coverImageUrl === "string" && coverImageUrl.length > 2048) {
    return NextResponse.json(
      { error: "La URL de la portada es demasiado larga." },
      { status: 400 }
    );
  }

  if (coverColor !== undefined && !HEX_COLOR_PATTERN.test(coverColor)) {
    return NextResponse.json(
      { error: "El color de portada no es válido." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("recorded_courses")
    .select("id, author_id, deleted_at")
    .eq("id", courseId)
    .single();

  if (!course || course.author_id !== user.id) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (course.deleted_at) {
    return NextResponse.json(
      { error: "No podés editar un curso eliminado." },
      { status: 400 }
    );
  }

  const updatePayload: { cover_image_url?: string | null; cover_color?: string } = {};

  if (body.cover_image_url !== undefined) {
    updatePayload.cover_image_url = coverImageUrl || null;
  }

  if (coverColor !== undefined) {
    updatePayload.cover_color = coverColor;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "No hay cambios para guardar." },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("recorded_courses")
    .update(updatePayload)
    .eq("id", courseId);

  if (error) {
    return NextResponse.json(
      { error: "No pudimos actualizar la portada del curso." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
