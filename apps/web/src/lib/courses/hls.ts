import { createAdminClient } from "@/lib/supabase/admin";

export type ModuleHlsStatus = {
  hasActiveHlsAsset: boolean;
  hasPendingOrProcessingHlsAsset: boolean;
};

export async function getModuleHlsStatus(
  moduleId: string
): Promise<ModuleHlsStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_video_assets")
    .select("processing_status, is_active")
    .eq("module_id", moduleId)
    .in("processing_status", ["pending", "processing", "ready"]);

  const rows = (data ?? []) as Array<{
    processing_status: "pending" | "processing" | "ready" | "failed";
    is_active: boolean;
  }>;

  return {
    hasActiveHlsAsset: rows.some(
      (row) => row.processing_status === "ready" && row.is_active === true
    ),
    hasPendingOrProcessingHlsAsset: rows.some(
      (row) =>
        row.processing_status === "pending" ||
        row.processing_status === "processing"
    ),
  };
}

export async function hasActiveHlsAsset(moduleId: string): Promise<boolean> {
  const { hasActiveHlsAsset } = await getModuleHlsStatus(moduleId);
  return hasActiveHlsAsset;
}
