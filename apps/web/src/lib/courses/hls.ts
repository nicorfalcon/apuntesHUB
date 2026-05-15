import { createAdminClient } from "@/lib/supabase/admin";

export type ModuleHlsStatus = {
  hasActiveHlsAsset: boolean;
  hasPendingOrProcessingHlsAsset: boolean;
};

export async function getModuleHlsStatus(
  moduleId: string,
  currentVideoStorageKey: string | null
): Promise<ModuleHlsStatus> {
  if (!currentVideoStorageKey) {
    return {
      hasActiveHlsAsset: false,
      hasPendingOrProcessingHlsAsset: false,
    };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("course_video_assets")
    .select("processing_status, is_active, original_video_storage_key")
    .eq("module_id", moduleId)
    .eq("original_video_storage_key", currentVideoStorageKey)
    .in("processing_status", ["pending", "processing", "ready"]);

  const rows = (data ?? []) as Array<{
    processing_status: "pending" | "processing" | "ready" | "failed";
    is_active: boolean;
    original_video_storage_key: string | null;
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

export async function hasActiveHlsAsset(
  moduleId: string,
  currentVideoStorageKey: string | null
): Promise<boolean> {
  const { hasActiveHlsAsset } = await getModuleHlsStatus(
    moduleId,
    currentVideoStorageKey
  );
  return hasActiveHlsAsset;
}
