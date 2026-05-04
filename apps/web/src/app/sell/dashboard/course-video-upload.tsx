"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  COURSE_VIDEO_MAX_BYTES,
  COURSE_VIDEO_MAX_LABEL,
  isAllowedCourseVideoType,
} from "@/lib/backblaze/config";

interface CourseVideoUploadProps {
  courseId: string;
  moduleId: string;
  hasVideo: boolean;
  label: string;
}

export function CourseVideoUpload({
  courseId,
  moduleId,
  hasVideo,
  label,
}: CourseVideoUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploaded, setUploaded] = useState(hasVideo);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (!isAllowedCourseVideoType(file.type)) {
      toast.error("Subí un video MP4, WebM o MOV.");
      return;
    }

    if (file.size > COURSE_VIDEO_MAX_BYTES) {
      toast.error(`El video no puede superar ${COURSE_VIDEO_MAX_LABEL}.`);
      return;
    }

    setLoading(true);
    try {
      const uploadUrlResponse = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type,
            size: file.size,
          }),
        }
      );

      const uploadUrlPayload = (await uploadUrlResponse.json().catch(() => null)) as
        | { upload_url?: string; storage_key?: string; error?: string }
        | null;

      if (
        !uploadUrlResponse.ok ||
        !uploadUrlPayload?.upload_url ||
        !uploadUrlPayload.storage_key
      ) {
        throw new Error(
          uploadUrlPayload?.error ?? "No pudimos preparar la subida."
        );
      }

      const uploadResponse = await fetch(uploadUrlPayload.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("No pudimos subir el video a Backblaze.");
      }

      const completeResponse = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storage_key: uploadUrlPayload.storage_key }),
        }
      );

      const completePayload = (await completeResponse.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!completeResponse.ok) {
        throw new Error(
          completePayload?.error ?? "No pudimos guardar el video del módulo."
        );
      }

      setUploaded(true);
      toast.success("Video del módulo actualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos cargar el video del módulo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{label}</p>
        <p
          className={`mt-0.5 inline-flex items-center gap-1 text-xs ${
            uploaded ? "text-green-700 dark:text-green-300" : "text-yellow-700 dark:text-yellow-200"
          }`}
        >
          {uploaded && <CheckCircle2 className="h-3.5 w-3.5" />}
          {uploaded ? "Video cargado" : "Falta video"}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="sr-only"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent-200 px-3 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UploadCloud className="h-3.5 w-3.5" />
        )}
        {uploaded ? "Reemplazar" : "Subir"}
      </button>
    </div>
  );
}
