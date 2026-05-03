"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, PlayCircle } from "lucide-react";
import { formatDuration } from "./format";
import type { CourseModuleSummary } from "./types";

interface CoursePlayerProps {
  courseId: string;
  courseTitle: string;
  modules: CourseModuleSummary[];
  currentModuleId: string;
  initialWatchedSeconds: number;
  watermarkEmail: string;
  /** Si el visitante es el autor sin enrollment, no se persiste progreso. */
  isAuthorPreview: boolean;
}

// Sample público usado mientras no haya integración con BackBlaze (Etapa 5).
const SAMPLE_VIDEO_SRC =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

// Posiciones que va rotando el watermark cada 30s (esquinas/centro).
const WATERMARK_POSITIONS = [
  "top-6 left-6",
  "top-6 right-6",
  "bottom-6 left-6",
  "bottom-6 right-6",
  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
] as const;

export function CoursePlayer({
  courseId,
  courseTitle,
  modules,
  currentModuleId,
  initialWatchedSeconds,
  watermarkEmail,
  isAuthorPreview,
}: CoursePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [watermarkIndex, setWatermarkIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const currentModule = useMemo(
    () => modules.find((m) => m.id === currentModuleId),
    [modules, currentModuleId]
  );
  const currentIndex = useMemo(
    () => modules.findIndex((m) => m.id === currentModuleId),
    [modules, currentModuleId]
  );
  const nextModule = currentIndex >= 0 ? modules[currentIndex + 1] : undefined;

  // Rotar la posición del watermark cada 30s.
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkIndex((i) => (i + 1) % WATERMARK_POSITIONS.length);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Setear posición inicial del video al watched_seconds previo.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || initialWatchedSeconds <= 0) return;

    const apply = () => {
      try {
        video.currentTime = Math.max(0, initialWatchedSeconds - 2);
      } catch {
        // Algunos browsers tiran si no está cargado todavía
      }
    };

    if (video.readyState >= 1) apply();
    else video.addEventListener("loadedmetadata", apply, { once: true });

    return () => video.removeEventListener("loadedmetadata", apply);
  }, [initialWatchedSeconds]);

  // Persistir progreso cada 10s mientras se reproduce.
  useEffect(() => {
    if (isAuthorPreview) return;
    const video = videoRef.current;
    if (!video) return;

    let lastSent = 0;

    const sendProgress = async (completedFlag = false) => {
      const seconds = Math.floor(video.currentTime || 0);
      if (!completedFlag && seconds === lastSent) return;
      lastSent = seconds;
      try {
        const res = await fetch(`/api/courses/${courseId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module_id: currentModuleId,
            watched_seconds: seconds,
            completed: completedFlag,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as {
            completed?: boolean;
          } | null;
          if (data?.completed) setCompleted(true);
        }
      } catch {
        // Falla silenciosa: reintentamos en el próximo tick
      }
    };

    const interval = setInterval(() => {
      if (!video.paused && !video.ended) sendProgress(false);
    }, 10000);

    const onEnded = () => sendProgress(true);
    const onPause = () => sendProgress(false);

    video.addEventListener("ended", onEnded);
    video.addEventListener("pause", onPause);

    return () => {
      clearInterval(interval);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("pause", onPause);
    };
  }, [courseId, currentModuleId, isAuthorPreview]);

  if (!currentModule) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:py-10">
        <div className="flex-1 min-w-0">
          <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/cursos/${courseId}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {courseTitle}
            </Link>
          </nav>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-sm dark:border-white/10">
            <video
              ref={videoRef}
              src={SAMPLE_VIDEO_SRC}
              controls
              controlsList="nodownload"
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black"
            />
            {/* Watermark overlay: rota posición cada 30s, no interactúa con controles */}
            {watermarkEmail && (
              <div
                className={`pointer-events-none absolute font-display text-base italic tracking-wide text-accent-300 transition-all duration-700 sm:text-lg ${WATERMARK_POSITIONS[watermarkIndex]}`}
                style={{ opacity: 0.18, mixBlendMode: "screen" }}
              >
                {watermarkEmail}
              </div>
            )}
            {isAuthorPreview && (
              <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                Vista previa del autor — sin progreso
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-accent-700 dark:text-accent-100">
              Módulo {currentModule.position} ·{" "}
              {formatDuration(currentModule.duration_seconds)}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">
              {currentModule.title}
            </h1>
            {currentModule.description && (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                {currentModule.description}
              </p>
            )}
            {completed && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                Módulo completado
              </div>
            )}
            {nextModule && (
              <div className="mt-6 flex">
                <Link
                  href={`/cursos/${courseId}/ver/${nextModule.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                >
                  Siguiente módulo
                  <PlayCircle className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <aside className="lg:w-80 lg:shrink-0">
          <div className="rounded-[24px] border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f1e1a]">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Módulos del curso
            </p>
            <ul className="space-y-1">
              {modules.map((courseModule) => {
                const active = courseModule.id === currentModuleId;
                return (
                  <li key={courseModule.id}>
                    <Link
                      href={`/cursos/${courseId}/ver/${courseModule.id}`}
                      className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100"
                          : "text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active
                            ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                            : "bg-gray-100 text-muted-foreground dark:bg-white/[0.06]"
                        }`}
                      >
                        {courseModule.position}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {courseModule.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(courseModule.duration_seconds)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
