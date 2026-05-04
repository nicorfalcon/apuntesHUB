import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  COURSE_VIDEO_MAX_BYTES,
  COURSE_VIDEO_MAX_LABEL,
  isAllowedCourseVideoType,
} from "@/lib/backblaze/config";
import {
  deleteCourseVideo,
  getCourseVideoMetadata,
} from "@/lib/backblaze/client";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { id: courseId, moduleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    storage_key?: string;
  } | null;

  const storageKey =
    typeof body?.storage_key === "string" ? body.storage_key.trim() : "";
  const expectedPrefix = `courses/${courseId}/modules/${moduleId}/`;

  if (!storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Video inválido" }, { status: 400 });
  }

  const { data: courseModule } = await supabase
    .from("course_modules")
    .select("id, video_storage_key, recorded_courses!inner(id, author_id)")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .single();

  const course = Array.isArray(courseModule?.recorded_courses)
    ? courseModule?.recorded_courses[0]
    : courseModule?.recorded_courses;

  if (!courseModule || course?.author_id !== user.id) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let metadata: Awaited<ReturnType<typeof getCourseVideoMetadata>>;
  try {
    metadata = await getCourseVideoMetadata(storageKey);
  } catch {
    return NextResponse.json(
      { error: "No encontramos el video subido." },
      { status: 400 }
    );
  }

  if ((metadata.ContentLength ?? 0) > COURSE_VIDEO_MAX_BYTES) {
    await deleteCourseVideo(storageKey).catch(() => undefined);
    return NextResponse.json(
      { error: `El video no puede superar ${COURSE_VIDEO_MAX_LABEL}.` },
      { status: 400 }
    );
  }

  if (
    metadata.ContentType &&
    !isAllowedCourseVideoType(metadata.ContentType.split(";")[0])
  ) {
    await deleteCourseVideo(storageKey).catch(() => undefined);
    return NextResponse.json(
      { error: "Subí un video MP4, WebM o MOV." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("course_modules")
    .update({
      video_storage_key: storageKey,
      video_duration_verified_at: new Date().toISOString(),
    })
    .eq("id", moduleId)
    .eq("course_id", courseId);

  if (error) {
    return NextResponse.json(
      { error: "No pudimos guardar el video del módulo." },
      { status: 500 }
    );
  }

  if (
    courseModule.video_storage_key &&
    courseModule.video_storage_key !== storageKey
  ) {
    await deleteCourseVideo(courseModule.video_storage_key).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, storage_key: storageKey });
}
