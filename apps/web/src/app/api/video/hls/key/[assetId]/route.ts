import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readPrivateObjectBytes } from "@/lib/backblaze/client";
import {
  assertCourseModuleAccess,
  CourseModuleAccessError,
} from "@/lib/courses/access";
import {
  isDocumentNavigationRequest,
  mediaEndpointNavigationResponse,
} from "@/lib/http/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CourseVideoAsset = {
  id: string;
  module_id: string;
  hls_key_storage_key: string | null;
  original_video_storage_key: string | null;
  processing_status: string;
  is_active: boolean;
};

type CourseModuleRef = {
  id: string;
  course_id: string;
  video_storage_key: string | null;
};

function accessErrorResponse(error: CourseModuleAccessError) {
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

async function getAssetAndModule(assetId: string) {
  const admin = createAdminClient();
  const { data: rawAsset, error: assetError } = await admin
    .from("course_video_assets")
    .select(
      "id, module_id, hls_key_storage_key, original_video_storage_key, processing_status, is_active"
    )
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    throw new Error("No pudimos buscar el asset HLS.");
  }

  if (!rawAsset || rawAsset.processing_status !== "ready") {
    return { asset: null, courseModule: null };
  }

  const asset = rawAsset as CourseVideoAsset;
  const { data: rawModule, error: moduleError } = await admin
    .from("course_modules")
    .select("id, course_id, video_storage_key")
    .eq("id", asset.module_id)
    .maybeSingle();

  if (moduleError) {
    throw new Error("No pudimos resolver el módulo del asset HLS.");
  }

  return {
    asset,
    courseModule: (rawModule as CourseModuleRef | null) ?? null,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  if (isDocumentNavigationRequest(request)) {
    return mediaEndpointNavigationResponse();
  }

  const { assetId } = await params;

  if (!UUID_PATTERN.test(assetId)) {
    return NextResponse.json({ error: "assetId inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let asset: CourseVideoAsset | null;
  let courseModule: CourseModuleRef | null;
  try {
    ({ asset, courseModule } = await getAssetAndModule(assetId));
  } catch {
    return NextResponse.json(
      { error: "No pudimos buscar el asset HLS." },
      { status: 500 }
    );
  }

  if (!asset || !courseModule || !asset.hls_key_storage_key) {
    return NextResponse.json({ error: "Asset HLS no encontrado" }, { status: 404 });
  }

  let access;
  try {
    access = await assertCourseModuleAccess({
      supabase,
      userId: user.id,
      courseId: courseModule.course_id,
      moduleId: courseModule.id,
    });
  } catch (error) {
    if (!(error instanceof CourseModuleAccessError)) throw error;
    return accessErrorResponse(error);
  }

  if (!asset.is_active && !access.isAuthor) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (
    !access.isAuthor &&
    asset.original_video_storage_key !== courseModule.video_storage_key
  ) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = await readPrivateObjectBytes(asset.hls_key_storage_key);
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer la key HLS." },
      { status: 502 }
    );
  }

  if (keyBytes.byteLength !== 16) {
    return NextResponse.json({ error: "Key HLS inválida" }, { status: 500 });
  }

  const keyBuffer = Buffer.from(keyBytes);
  const responseBody = keyBuffer.buffer.slice(
    keyBuffer.byteOffset,
    keyBuffer.byteOffset + keyBuffer.byteLength
  ) as ArrayBuffer;

  return new NextResponse(responseBody, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
