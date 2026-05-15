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

  const admin = createAdminClient();
  const { data: courseModule } = await admin
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
    const deactivateError = await deactivateStaleActiveHlsAssets({
      admin,
      moduleId,
      storageKey,
    });

    if (deactivateError) {
      return NextResponse.json(
        { error: "No pudimos actualizar los assets HLS del módulo." },
        { status: 500 }
      );
    }
  }

  if (
    courseModule.video_storage_key &&
    courseModule.video_storage_key !== storageKey
  ) {
    await deleteCourseVideo(courseModule.video_storage_key).catch(() => undefined);
  }

  await enqueueHlsAsset({ admin, moduleId, storageKey }).catch((err) => {
    console.error(
      "[video confirm] enqueue HLS asset failed:",
      err instanceof Error ? err.message : err
    );
  });

  return NextResponse.json({ ok: true, storage_key: storageKey });
}

type ExistingAssetRow = {
  id: string;
  processing_status: "pending" | "processing" | "ready" | "failed";
  is_active: boolean;
  original_video_storage_key: string | null;
};

async function deactivateStaleActiveHlsAssets({
  admin,
  moduleId,
  storageKey,
}: {
  admin: ReturnType<typeof createAdminClient>;
  moduleId: string;
  storageKey: string;
}) {
  const { data: activeAssets, error: listError } = await admin
    .from("course_video_assets")
    .select("id, original_video_storage_key")
    .eq("module_id", moduleId)
    .eq("is_active", true);

  if (listError) {
    return listError;
  }

  const staleAssetIds = (activeAssets ?? [])
    .filter((asset) => asset.original_video_storage_key !== storageKey)
    .map((asset) => asset.id);

  if (staleAssetIds.length === 0) {
    return null;
  }

  const { error } = await admin
    .from("course_video_assets")
    .update({ is_active: false })
    .eq("module_id", moduleId)
    .in("id", staleAssetIds);

  return error;
}

async function enqueueHlsAsset({
  admin,
  moduleId,
  storageKey,
}: {
  admin: ReturnType<typeof createAdminClient>;
  moduleId: string;
  storageKey: string;
}) {
  const { data: existing, error: listError } = await admin
    .from("course_video_assets")
    .select("id, processing_status, is_active, original_video_storage_key")
    .eq("module_id", moduleId);

  if (listError) {
    throw new Error(listError.message);
  }

  const rows = (existing ?? []) as ExistingAssetRow[];
  const deactivateError = await deactivateStaleActiveHlsAssets({
    admin,
    moduleId,
    storageKey,
  });

  if (deactivateError) {
    throw new Error(deactivateError.message);
  }

  const sameKey = rows.filter(
    (a) => a.original_video_storage_key === storageKey
  );

  const sameKeyInFlight = sameKey.find(
    (a) => a.processing_status === "pending" || a.processing_status === "processing"
  );
  const sameKeyActiveReady = sameKey.find(
    (a) => a.processing_status === "ready" && a.is_active === true
  );

  if (sameKeyInFlight || sameKeyActiveReady) {
    return;
  }

  const staleInFlight = rows.filter(
    (a) =>
      (a.processing_status === "pending" || a.processing_status === "processing") &&
      a.original_video_storage_key !== storageKey
  );

  for (const stale of staleInFlight) {
    await admin
      .from("course_video_assets")
      .update({
        processing_status: "failed",
        processing_stage: "failed",
        error_message: "superseded by new upload",
        is_active: false,
      })
      .eq("id", stale.id)
      .in("processing_status", ["pending", "processing"]);
  }

  const { error: insertError } = await admin
    .from("course_video_assets")
    .insert({
      module_id: moduleId,
      original_video_storage_key: storageKey,
      processing_status: "pending",
      processing_stage: "pending",
      processing_progress: 0,
      is_active: false,
      error_message: null,
    });

  if (insertError) {
    throw new Error(insertError.message);
  }
}
