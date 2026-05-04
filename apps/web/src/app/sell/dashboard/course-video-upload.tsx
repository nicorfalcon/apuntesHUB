"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  COURSE_VIDEO_MAX_BYTES,
  COURSE_VIDEO_MAX_LABEL,
  isAllowedCourseVideoType,
} from "@/lib/backblaze/config";
import { useCourseVideoUploads } from "@/components/uploads/course-video-upload-provider";

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
  const [uploadId, setUploadId] = useState<string | null>(null);
  const { startCourseVideoUpload, tasks } = useCourseVideoUploads();
  const currentTask = useMemo(
    () => tasks.find((task) => task.id === uploadId) ?? null,
    [tasks, uploadId]
  );
  const loading =
    currentTask !== null &&
    currentTask.status !== "completed" &&
    currentTask.status !== "failed";

  useEffect(() => {
    if (!currentTask) return;

    if (currentTask.status === "completed") {
      setUploaded(true);
      setUploadId(null);
    }

    if (currentTask.status === "failed") {
      setUploadId(null);
    }
  }, [currentTask]);

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

    const id = startCourseVideoUpload({
      courseId,
      moduleId,
      file,
      label,
      successMessage: "Video del módulo actualizado.",
    });
    setUploadId(id);
    toast.message("La subida sigue en segundo plano.");
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{label}</p>
        <p
          className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${
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
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent-200 px-2.5 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
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
