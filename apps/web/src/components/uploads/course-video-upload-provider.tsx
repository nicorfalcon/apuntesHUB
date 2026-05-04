"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

type UploadStatus = "queued" | "preparing" | "uploading" | "saving" | "completed" | "failed";

export interface CourseVideoUploadTask {
  id: string;
  groupId: string | null;
  courseId: string;
  moduleId: string;
  label: string;
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  progress: number;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

interface CourseVideoUploadInput {
  courseId: string;
  moduleId: string;
  file: File;
  label: string;
  successMessage?: string;
  notifyOnComplete?: boolean;
}

interface CourseVideoUploadBatchInput {
  courseId: string;
  courseTitle: string;
  publishAfterComplete: boolean;
  items: {
    moduleId: string;
    file: File;
    label: string;
  }[];
}

interface CourseVideoUploadContextValue {
  tasks: CourseVideoUploadTask[];
  startCourseVideoUpload: (input: CourseVideoUploadInput) => string;
  startCourseVideoUploadBatch: (input: CourseVideoUploadBatchInput) => string[];
  dismissCourseVideoUpload: (id: string) => void;
}

const CourseVideoUploadContext =
  createContext<CourseVideoUploadContextValue | null>(null);

const FINAL_STATUSES = new Set<UploadStatus>(["completed", "failed"]);

function createUploadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getStatusLabel(task: CourseVideoUploadTask) {
  if (task.status === "queued") return "En espera";
  if (task.status === "preparing") return "Preparando";
  if (task.status === "uploading") return `${task.progress}%`;
  if (task.status === "saving") return "Guardando";
  if (task.status === "completed") return "Completado";
  return "Falló";
}

function uploadFileWithProgress({
  url,
  file,
  contentType,
  onProgress,
}: {
  url: string;
  file: File;
  contentType: string;
  onProgress: (progress: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let lastProgress = 0;

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
      if (progress !== lastProgress) {
        lastProgress = progress;
        onProgress(progress);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error("No pudimos subir el video a Backblaze."));
    };

    request.onerror = () => {
      reject(new Error("No pudimos conectar con Backblaze."));
    };

    request.onabort = () => {
      reject(new Error("La subida fue cancelada."));
    };

    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}

export function CourseVideoUploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<CourseVideoUploadTask[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const updateTask = useCallback(
    (id: string, patch: Partial<CourseVideoUploadTask>) => {
      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, ...patch } : task))
      );
    },
    []
  );

  const dismissCourseVideoUpload = useCallback((id: string) => {
    setTasks((current) =>
      current.filter((task) => task.id !== id || !FINAL_STATUSES.has(task.status))
    );
  }, []);

  const dismissLater = useCallback((id: string) => {
    window.setTimeout(() => {
      setTasks((current) =>
        current.filter((task) => task.id !== id || task.status !== "completed")
      );
    }, 12000);
  }, []);

  const runUploadTask = useCallback(
    async (id: string, input: CourseVideoUploadInput) => {
      try {
        updateTask(id, { status: "preparing", progress: 0, error: null });

        const uploadUrlResponse = await fetch(
          `/api/courses/${input.courseId}/modules/${input.moduleId}/upload-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_name: input.file.name,
              content_type: input.file.type,
              size: input.file.size,
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
            uploadUrlPayload?.error ?? "No pudimos preparar la subida del video."
          );
        }

        updateTask(id, { status: "uploading", progress: 0 });

        await uploadFileWithProgress({
          url: uploadUrlPayload.upload_url,
          file: input.file,
          contentType: input.file.type,
          onProgress: (progress) => updateTask(id, { progress }),
        });

        updateTask(id, { status: "saving", progress: 100 });

        const completeResponse = await fetch(
          `/api/courses/${input.courseId}/modules/${input.moduleId}/video`,
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

        updateTask(id, {
          status: "completed",
          progress: 100,
          error: null,
          completedAt: Date.now(),
        });
        dismissLater(id);
        router.refresh();

        if (input.notifyOnComplete ?? true) {
          toast.success(input.successMessage ?? "Video del módulo actualizado.");
        }

        return uploadUrlPayload.storage_key;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No pudimos cargar el video del módulo.";

        updateTask(id, {
          status: "failed",
          error: message,
          completedAt: Date.now(),
        });

        if (input.notifyOnComplete ?? true) {
          toast.error(message);
        }

        throw error;
      }
    },
    [dismissLater, router, updateTask]
  );

  const enqueueUpload = useCallback(
    (input: CourseVideoUploadInput, groupId: string | null = null) => {
      const id = createUploadId();
      const task: CourseVideoUploadTask = {
        id,
        groupId,
        courseId: input.courseId,
        moduleId: input.moduleId,
        label: input.label,
        fileName: input.file.name,
        fileSize: input.file.size,
        status: "queued",
        progress: 0,
        error: null,
        createdAt: Date.now(),
        completedAt: null,
      };

      setTasks((current) => [...current, task]);
      setCollapsed(false);

      const promise = queueRef.current.then(() => runUploadTask(id, input));
      queueRef.current = promise.catch(() => undefined);

      return { id, promise };
    },
    [runUploadTask]
  );

  const startCourseVideoUpload = useCallback(
    (input: CourseVideoUploadInput) => enqueueUpload(input).id,
    [enqueueUpload]
  );

  const startCourseVideoUploadBatch = useCallback(
    (input: CourseVideoUploadBatchInput) => {
      const groupId = createUploadId();
      const entries = input.items.map((item) =>
        enqueueUpload(
          {
            courseId: input.courseId,
            moduleId: item.moduleId,
            file: item.file,
            label: item.label,
            notifyOnComplete: false,
          },
          groupId
        )
      );

      void Promise.all(entries.map((entry) => entry.promise))
        .then(async () => {
          if (!input.publishAfterComplete) {
            toast.success("Videos del curso cargados.");
            router.refresh();
            return;
          }

          const publishResponse = await fetch(`/api/courses/${input.courseId}/publish`, {
            method: "POST",
          });
          const publishPayload = (await publishResponse.json().catch(() => null)) as
            | { error?: string }
            | null;

          if (!publishResponse.ok) {
            throw new Error(
              publishPayload?.error ??
                "Los videos se cargaron, pero no pudimos publicar el curso."
            );
          }

          toast.success(`"${input.courseTitle}" ya está publicado.`);
          router.refresh();
        })
        .catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Algún video no pudo cargarse. El curso queda como borrador."
          );
        });

      return entries.map((entry) => entry.id);
    },
    [enqueueUpload, router]
  );

  const activeUploadCount = tasks.filter((task) => !FINAL_STATUSES.has(task.status)).length;
  const completedCount = tasks.filter((task) => task.status === "completed").length;

  useEffect(() => {
    if (activeUploadCount === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeUploadCount]);

  const value = useMemo(
    () => ({
      tasks,
      startCourseVideoUpload,
      startCourseVideoUploadBatch,
      dismissCourseVideoUpload,
    }),
    [
      dismissCourseVideoUpload,
      startCourseVideoUpload,
      startCourseVideoUploadBatch,
      tasks,
    ]
  );

  return (
    <CourseVideoUploadContext.Provider value={value}>
      {children}
      {tasks.length > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-50 sm:left-auto sm:right-4 sm:w-[390px]">
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#0b1f1a] dark:shadow-black/35">
            <div className="flex h-12 items-center justify-between border-b border-gray-100 px-4 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                  {activeUploadCount > 0 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-foreground">
                    {activeUploadCount > 0
                      ? `${activeUploadCount} subida${
                          activeUploadCount === 1 ? "" : "s"
                        } en curso`
                      : "Subidas finalizadas"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {completedCount} completada{completedCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground dark:hover:bg-white/10"
                aria-label={collapsed ? "Mostrar subidas" : "Ocultar subidas"}
              >
                {collapsed ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {!collapsed && (
              <div className="max-h-[320px] overflow-y-auto p-3">
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const isFailed = task.status === "failed";
                    const isCompleted = task.status === "completed";

                    return (
                      <div
                        key={task.id}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isFailed
                                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-200"
                                : isCompleted
                                  ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-200"
                                  : "bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100"
                            }`}
                          >
                            {isFailed ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <UploadCloud className="h-4 w-4" />
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {task.label}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {task.fileName} · {formatBytes(task.fileSize)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <span
                                  className={`text-xs font-semibold ${
                                    isFailed
                                      ? "text-red-600 dark:text-red-200"
                                      : isCompleted
                                        ? "text-green-700 dark:text-green-200"
                                        : "text-accent-700 dark:text-accent-100"
                                  }`}
                                >
                                  {getStatusLabel(task)}
                                </span>
                                {FINAL_STATUSES.has(task.status) && (
                                  <button
                                    type="button"
                                    onClick={() => dismissCourseVideoUpload(task.id)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-200 hover:text-foreground dark:hover:bg-white/10"
                                    aria-label="Quitar subida"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                              <div
                                className={`h-full rounded-full transition-[width] duration-300 ${
                                  isFailed
                                    ? "bg-red-500"
                                    : isCompleted
                                      ? "bg-green-500"
                                      : "bg-accent-500 dark:bg-accent-300"
                                }`}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>

                            {task.error && (
                              <p className="mt-2 text-xs leading-5 text-red-600 dark:text-red-200">
                                {task.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </CourseVideoUploadContext.Provider>
  );
}

export function useCourseVideoUploads() {
  const context = useContext(CourseVideoUploadContext);

  if (!context) {
    throw new Error(
      "useCourseVideoUploads must be used inside CourseVideoUploadProvider"
    );
  }

  return context;
}
