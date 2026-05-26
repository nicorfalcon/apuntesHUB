import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readPrivateObjectText } from "@/lib/backblaze/client";
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

const KEY_URI_PLACEHOLDER = "__HLS_KEY_URI__";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CourseVideoAsset = {
  id: string;
  module_id: string;
  hls_playlist_storage_key: string | null;
  hls_segment_prefix: string | null;
  hls_key_storage_key: string | null;
  original_video_storage_key: string | null;
  processing_status: string;
  is_active: boolean;
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

async function findReadyHlsAsset({
  moduleId,
  assetId,
  canUseInactiveAsset,
  currentVideoStorageKey,
}: {
  moduleId: string;
  assetId: string | null;
  canUseInactiveAsset: boolean;
  currentVideoStorageKey: string | null;
}) {
  if (!assetId && !currentVideoStorageKey) {
    return { data: null, error: null };
  }

  const admin = createAdminClient();
  let query = admin
    .from("course_video_assets")
    .select(
      "id, module_id, hls_playlist_storage_key, hls_segment_prefix, hls_key_storage_key, original_video_storage_key, processing_status, is_active"
    )
    .eq("module_id", moduleId)
    .eq("processing_status", "ready");

  if (assetId) {
    if (!canUseInactiveAsset) {
      return { data: null, error: null };
    }
    query = query.eq("id", assetId);
  } else {
    query = query
      .eq("is_active", true)
      .eq("original_video_storage_key", currentVideoStorageKey);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (data && data.module_id !== moduleId) {
    return { data: null, error: null };
  }

  if (data && assetId && !data.is_active && !canUseInactiveAsset) {
    return { data: null, error: null };
  }

  return {
    data: data as CourseVideoAsset | null,
    error: null,
  };
}

function validateAssetStorage(asset: CourseVideoAsset) {
  if (
    !asset.hls_playlist_storage_key ||
    !asset.hls_segment_prefix ||
    !asset.hls_key_storage_key
  ) {
    return false;
  }

  return true;
}

function buildSegmentStorageKey({
  segmentUri,
  segmentPrefix,
}: {
  segmentUri: string;
  segmentPrefix: string;
}) {
  const trimmedUri = segmentUri.trim();

  if (!/^segment_\d+\.ts$/.test(trimmedUri)) {
    throw new Error(`Segmento HLS inválido: ${trimmedUri}`);
  }

  if (!segmentPrefix.endsWith("segment_")) {
    throw new Error("hls_segment_prefix inválido.");
  }

  return `${segmentPrefix}${trimmedUri.slice("segment_".length)}`;
}

async function rewritePlaylist({
  playlist,
  asset,
}: {
  playlist: string;
  asset: CourseVideoAsset;
}) {
  if (!playlist.includes(KEY_URI_PLACEHOLDER)) {
    throw new Error("La playlist HLS no contiene el placeholder de key.");
  }

  if (!asset.hls_segment_prefix) {
    throw new Error("El asset no tiene hls_segment_prefix.");
  }

  const keyUri = `/api/video/hls/key/${asset.id}`;
  const lines = playlist.replaceAll(KEY_URI_PLACEHOLDER, keyUri).split(/\r?\n/);
  const rewrittenLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      rewrittenLines.push(line);
      continue;
    }

    buildSegmentStorageKey({
      segmentUri: trimmedLine,
      segmentPrefix: asset.hls_segment_prefix,
    });

    rewrittenLines.push(
      `/api/video/hls/segment/${asset.id}/${encodeURIComponent(trimmedLine)}`
    );
  }

  return rewrittenLines.join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  if (isDocumentNavigationRequest(request)) {
    return mediaEndpointNavigationResponse();
  }

  const { id: courseId, moduleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

  const requestedAssetId = request.nextUrl.searchParams.get("assetId")?.trim() || null;

  if (requestedAssetId && !UUID_PATTERN.test(requestedAssetId)) {
    return NextResponse.json({ error: "assetId inválido" }, { status: 400 });
  }

  const { data: asset, error } = await findReadyHlsAsset({
    moduleId,
    assetId: requestedAssetId,
    canUseInactiveAsset: access.isAuthor,
    currentVideoStorageKey: access.module.video_storage_key,
  });

  if (error) {
    return NextResponse.json(
      { error: "No pudimos buscar el asset HLS." },
      { status: 500 }
    );
  }

  if (!asset) {
    return NextResponse.json({ error: "Asset HLS no encontrado" }, { status: 404 });
  }

  if (!asset.is_active && !access.isAuthor) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (
    !access.isAuthor &&
    asset.original_video_storage_key !== access.module.video_storage_key
  ) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (!validateAssetStorage(asset)) {
    return NextResponse.json(
      { error: "Asset HLS incompleto" },
      { status: 500 }
    );
  }

  let playlist: string;
  try {
    playlist = await readPrivateObjectText(asset.hls_playlist_storage_key!);
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer la playlist HLS." },
      { status: 502 }
    );
  }

  let rewrittenPlaylist: string;
  try {
    rewrittenPlaylist = await rewritePlaylist({ playlist, asset });
  } catch {
    return NextResponse.json(
      { error: "Playlist HLS inválida" },
      { status: 500 }
    );
  }

  return new NextResponse(rewrittenPlaylist, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
