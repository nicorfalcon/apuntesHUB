import { NextResponse } from "next/server";
import { createCourseVideoReadUrl } from "@/lib/backblaze/client";
import {
  assertCourseModuleAccess,
  CourseModuleAccessError,
} from "@/lib/courses/access";
import { getModuleHlsStatus } from "@/lib/courses/hls";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function accessErrorResponse(error: CourseModuleAccessError) {
  const statusByCode = {
    unauthenticated: 401,
    forbidden: 403,
    not_found: 404,
  } as const;

  return jsonResponse({ error: error.message }, statusByCode[error.code]);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { id: courseId, moduleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  let access;
  try {
    access = await assertCourseModuleAccess({
      supabase,
      userId: user.id,
      courseId,
      moduleId,
    });
  } catch (error) {
    if (!(error instanceof CourseModuleAccessError)) throw error;
    return accessErrorResponse(error);
  }

  if (!access.module.video_storage_key) {
    return jsonResponse({ error: "Video no encontrado" }, 404);
  }

  const hlsStatus = await getModuleHlsStatus(access.module.id);
  if (hlsStatus.hasActiveHlsAsset && !access.isAuthor) {
    return jsonResponse(
      { error: "El módulo usa HLS; el fallback MP4 no está disponible." },
      403
    );
  }
  if (
    hlsStatus.hasPendingOrProcessingHlsAsset &&
    !hlsStatus.hasActiveHlsAsset &&
    !access.isAuthor
  ) {
    return jsonResponse(
      {
        error:
          "El video se está procesando, intentá nuevamente en unos minutos.",
      },
      409
    );
  }

  try {
    const videoUrl = await createCourseVideoReadUrl(
      access.module.video_storage_key
    );

    return jsonResponse({ videoUrl });
  } catch {
    return jsonResponse(
      { error: "No pudimos generar la URL del video." },
      500
    );
  }
}
