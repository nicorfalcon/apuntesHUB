import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  assertCourseModuleAccess,
  CourseModuleAccessError,
} from "@/lib/courses/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProcessingStatus = "pending" | "processing" | "ready" | "failed";
type ProcessingStage =
  | "pending"
  | "downloading"
  | "transcoding"
  | "uploading"
  | "ready"
  | "failed";

type HlsStatusAsset = {
  id: string;
  processing_status: ProcessingStatus;
  processing_stage: string | null;
  processing_progress: number | null;
  is_active: boolean;
  created_at: string;
};

const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  pending: "El video está en cola de procesamiento.",
  downloading: "Preparando el video...",
  transcoding: "Convirtiendo el video a HLS...",
  uploading: "Subiendo los segmentos protegidos...",
  ready: "El video ya está listo.",
  failed: "No pudimos procesar el video todavía.",
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

function fallbackStage(status: ProcessingStatus): ProcessingStage {
  if (status === "processing") return "transcoding";
  return status;
}

function normalizeStage(asset: HlsStatusAsset): ProcessingStage {
  const stage = asset.processing_stage;

  if (
    stage === "pending" ||
    stage === "downloading" ||
    stage === "transcoding" ||
    stage === "uploading" ||
    stage === "ready" ||
    stage === "failed"
  ) {
    return stage;
  }

  return fallbackStage(asset.processing_status);
}

function normalizeProgress(asset: HlsStatusAsset) {
  if (asset.processing_status === "ready") return 100;

  const progress = asset.processing_progress;
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return asset.processing_status === "pending" ? 0 : null;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
}

function selectRelevantAsset(rows: HlsStatusAsset[]) {
  return (
    rows.find(
      (asset) =>
        asset.processing_status === "ready" && asset.is_active === true
    ) ??
    rows.find((asset) => asset.processing_status === "processing") ??
    rows.find((asset) => asset.processing_status === "pending") ??
    rows.find((asset) => asset.processing_status === "failed") ??
    null
  );
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
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await assertCourseModuleAccess({
      supabase,
      userId: user.id,
      courseId,
      moduleId,
    });
  } catch (error) {
    if (!(error instanceof CourseModuleAccessError)) throw error;
    return accessErrorResponse(error);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_video_assets")
    .select(
      "id, processing_status, processing_stage, processing_progress, is_active, created_at"
    )
    .eq("module_id", moduleId)
    .in("processing_status", ["pending", "processing", "ready", "failed"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "No pudimos buscar el estado HLS." },
      { status: 500 }
    );
  }

  const asset = selectRelevantAsset((data ?? []) as HlsStatusAsset[]);

  if (!asset) {
    return NextResponse.json(
      { error: "Asset HLS no encontrado" },
      { status: 404 }
    );
  }

  const stage = normalizeStage(asset);

  return NextResponse.json(
    {
      status: asset.processing_status,
      stage,
      progress: normalizeProgress(asset),
      message: STAGE_MESSAGES[stage],
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
