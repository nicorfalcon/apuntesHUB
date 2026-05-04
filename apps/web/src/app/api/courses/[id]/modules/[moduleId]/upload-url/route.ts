import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  COURSE_VIDEO_MAX_BYTES,
  COURSE_VIDEO_MAX_LABEL,
  getCourseVideoExtension,
  isAllowedCourseVideoType,
} from "@/lib/backblaze/config";
import { createCourseVideoUploadUrl } from "@/lib/backblaze/client";

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
    file_name?: string;
    content_type?: string;
    size?: number;
  } | null;

  const fileName = typeof body?.file_name === "string" ? body.file_name : "";
  const contentType =
    typeof body?.content_type === "string" ? body.content_type : "";
  const size = Number(body?.size ?? 0);

  if (!fileName || !isAllowedCourseVideoType(contentType)) {
    return NextResponse.json(
      { error: "Subí un video MP4, WebM o MOV." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(size) || size <= 0 || size > COURSE_VIDEO_MAX_BYTES) {
    return NextResponse.json(
      { error: `El video no puede superar ${COURSE_VIDEO_MAX_LABEL}.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: courseModule } = await admin
    .from("course_modules")
    .select("id, recorded_courses!inner(id, author_id)")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .single();

  const course = Array.isArray(courseModule?.recorded_courses)
    ? courseModule?.recorded_courses[0]
    : courseModule?.recorded_courses;

  if (!courseModule || course?.author_id !== user.id) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const extension = getCourseVideoExtension(fileName, contentType);
  const storageKey = `courses/${courseId}/modules/${moduleId}/${randomUUID()}.${extension}`;
  const uploadUrl = await createCourseVideoUploadUrl({
    key: storageKey,
    contentType,
    size,
  });

  return NextResponse.json({
    upload_url: uploadUrl,
    storage_key: storageKey,
    max_bytes: COURSE_VIDEO_MAX_BYTES,
  });
}
