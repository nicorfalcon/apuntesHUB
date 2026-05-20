"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { MaterialQuestionsPanel } from "@/components/material-questions";
import { formatDuration } from "./format";
import type { CourseModuleSummary } from "./types";
import type Hls from "hls.js";

type PlaybackType = "hls" | "mp4";

interface CoursePlayerProps {
  courseId: string;
  courseTitle: string;
  modules: CourseModuleSummary[];
  currentModuleId: string;
  initialWatchedSeconds: number;
  playbackType: PlaybackType;
  hlsSrc: string | null;
  mp4Src: string | null;
  mp4FallbackUrlEndpoint?: string | null;
  /**
   * Política explícita: si es false, el player NO intentará pedir signed URLs
   * MP4 cuando HLS falla. Para alumnos en módulos con HLS activo, esto debe
   * venir en false; el endpoint server también devuelve 403, esto es defensa
   * adicional en cliente.
   */
  allowMp4Fallback?: boolean;
  watermarkEmail: string;
  moduleProgress: Record<string, { watchedSeconds: number; completed: boolean }>;
  /** Si el visitante es el autor sin enrollment, no se persiste progreso. */
  isAuthorPreview: boolean;
  /**
   * Mensaje a mostrar en el placeholder cuando no hay video reproducible
   * (por ejemplo: HLS pending/processing para un comprador). Si es null y no
   * hay sources, se muestra el placeholder genérico "todavía no tiene video".
   */
  videoUnavailableMessage?: string | null;
  hlsProcessingStatusEndpoint?: string | null;
}

type HlsProcessingStage =
  | "pending"
  | "downloading"
  | "transcoding"
  | "uploading"
  | "ready"
  | "failed";

type HlsProcessingStatus = {
  status: "pending" | "processing" | "ready" | "failed";
  stage: HlsProcessingStage;
  progress: number | null;
  message: string;
};

const HLS_PROCESSING_POLL_MS = 7000;

const HLS_PROCESSING_MESSAGES: Record<HlsProcessingStage, string> = {
  pending: "El video está en cola de procesamiento.",
  downloading: "Preparando el video...",
  transcoding: "Convirtiendo el video a HLS...",
  uploading: "Subiendo los segmentos protegidos...",
  ready: "El video ya está listo.",
  failed: "No pudimos procesar el video todavía.",
};

// Posiciones que va rotando el watermark cada 30s (esquinas/centro).
const WATERMARK_POSITIONS = [
  "top-6 left-6",
  "top-6 right-6",
  "bottom-6 left-6",
  "bottom-6 right-6",
  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
] as const;

function getHlsStatusCode(errorData: unknown) {
  const data = errorData as {
    response?: { code?: number };
    networkDetails?: { status?: number };
  };

  return data.response?.code ?? data.networkDetails?.status ?? null;
}

function isHlsProcessingStage(stage: unknown): stage is HlsProcessingStage {
  return (
    stage === "pending" ||
    stage === "downloading" ||
    stage === "transcoding" ||
    stage === "uploading" ||
    stage === "ready" ||
    stage === "failed"
  );
}

function parseHlsProcessingStatus(data: unknown): HlsProcessingStatus | null {
  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;
  const status = raw.status;
  const stage = raw.stage;

  if (
    status !== "pending" &&
    status !== "processing" &&
    status !== "ready" &&
    status !== "failed"
  ) {
    return null;
  }

  const safeStage = isHlsProcessingStage(stage)
    ? stage
    : status === "processing"
      ? "transcoding"
      : status;
  const progress =
    typeof raw.progress === "number" && Number.isFinite(raw.progress)
      ? Math.max(0, Math.min(100, Math.round(raw.progress)))
      : null;
  const message =
    typeof raw.message === "string" && raw.message.trim()
      ? raw.message
      : HLS_PROCESSING_MESSAGES[safeStage];

  return {
    status,
    stage: safeStage,
    progress,
    message,
  };
}

function HlsProcessingPlaceholder({
  initialMessage,
  statusEndpoint,
}: {
  initialMessage: string;
  statusEndpoint: string | null;
}) {
  const router = useRouter();
  const [processingStatus, setProcessingStatus] =
    useState<HlsProcessingStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!statusEndpoint) return;

    const endpoint = statusEndpoint;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    function scheduleNextPoll() {
      timer = setTimeout(() => {
        void pollStatus();
      }, HLS_PROCESSING_POLL_MS);
    }

    async function pollStatus() {
      activeController?.abort();
      activeController = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
          signal: activeController.signal,
        });

        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          setProcessingStatus({
            status: "failed",
            stage: "failed",
            progress: null,
            message: "No pudimos consultar el estado del video.",
          });
          return;
        }

        if (response.ok) {
          const data = parseHlsProcessingStatus(
            await response.json().catch(() => null)
          );

          if (data) {
            setProcessingStatus(data);
            if (data.status === "ready" || data.status === "failed") {
              return;
            }
          }
        }

        scheduleNextPoll();
      } catch (error) {
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        if (!cancelled && !aborted) {
          scheduleNextPoll();
        }
      }
    }

    void pollStatus();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      activeController?.abort();
    };
  }, [statusEndpoint]);

  const stage = processingStatus?.stage ?? "pending";
  const progress = processingStatus?.progress;
  const isReady = processingStatus?.status === "ready";
  const isFailed = processingStatus?.status === "failed";
  const message =
    processingStatus?.message ??
    (statusEndpoint ? HLS_PROCESSING_MESSAGES[stage] : initialMessage);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
  };

  return (
    <div className="w-full max-w-md text-white">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
        {isReady ? (
          <CheckCircle2 className="h-6 w-6 text-green-300" />
        ) : isFailed ? (
          <AlertTriangle className="h-6 w-6 text-amber-300" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-white/85" />
        )}
      </div>
      <p className="text-sm font-semibold text-white/85">{message}</p>
      {typeof progress === "number" && (
        <div className="mt-5">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Progreso del procesamiento HLS"
          >
            <div
              className="h-full rounded-full bg-accent-300 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-white/70">{progress}%</p>
        </div>
      )}
      {isReady && (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-white/90 disabled:cursor-wait disabled:opacity-70"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Reproducir ahora
        </button>
      )}
    </div>
  );
}

export function CoursePlayer({
  courseId,
  courseTitle,
  modules,
  currentModuleId,
  initialWatchedSeconds,
  playbackType,
  hlsSrc,
  mp4Src,
  mp4FallbackUrlEndpoint,
  allowMp4Fallback = true,
  watermarkEmail,
  moduleProgress,
  isAuthorPreview,
  videoUnavailableMessage = null,
  hlsProcessingStatusEndpoint = null,
}: CoursePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [watermarkIndex, setWatermarkIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [progressByModule, setProgressByModule] = useState(moduleProgress);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [currentSecond, setCurrentSecond] = useState(initialWatchedSeconds);

  const currentModule = useMemo(
    () => modules.find((m) => m.id === currentModuleId),
    [modules, currentModuleId]
  );
  const currentIndex = useMemo(
    () => modules.findIndex((m) => m.id === currentModuleId),
    [modules, currentModuleId]
  );
  const nextModule = currentIndex >= 0 ? modules[currentIndex + 1] : undefined;

  useEffect(() => {
    setProgressByModule(moduleProgress);
  }, [moduleProgress]);

  useEffect(() => {
    setCompleted(Boolean(moduleProgress[currentModuleId]?.completed));
  }, [currentModuleId, moduleProgress]);

  useEffect(() => {
    setCurrentSecond(initialWatchedSeconds);
  }, [currentModuleId, initialWatchedSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentSecond(Math.max(0, Math.floor(video.currentTime || 0)));
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [currentModuleId, hlsSrc, mp4Src]);

  // Rotar la posición del watermark cada 30s.
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkIndex((i) => (i + 1) % WATERMARK_POSITIONS.length);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hls: Hls | null = null;
    let fallbackRequested = false;

    const clearVideoSource = () => {
      if (cancelled) return;
      video.removeAttribute("src");
      video.load();
    };

    const setVideoSource = (src: string) => {
      if (cancelled) return;
      video.src = src;
      video.load();
    };

    const showAuthorizationError = () => {
      if (cancelled) return;
      clearVideoSource();
      setPlaybackNotice("No tenés autorización para reproducir este video.");
    };

    const loadMp4Fallback = async (message: string) => {
      if (cancelled || fallbackRequested) return;
      fallbackRequested = true;
      console.warn(message);

      if (!allowMp4Fallback) {
        clearVideoSource();
        setPlaybackNotice(
          "No pudimos reproducir el video. Probá recargar la página."
        );
        return;
      }

      if (mp4Src) {
        setPlaybackNotice("No pudimos cargar HLS. Reproduciendo fallback MP4.");
        setVideoSource(mp4Src);
        return;
      }

      if (!mp4FallbackUrlEndpoint) {
        setPlaybackNotice(message);
        clearVideoSource();
        return;
      }

      setPlaybackNotice("No pudimos cargar HLS. Intentando fallback MP4.");

      try {
        const response = await fetch(mp4FallbackUrlEndpoint, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          showAuthorizationError();
          return;
        }

        if (!response.ok) {
          clearVideoSource();
          setPlaybackNotice("No pudimos cargar el fallback MP4.");
          return;
        }

        const data = (await response.json().catch(() => null)) as {
          videoUrl?: unknown;
        } | null;

        if (cancelled) return;

        if (typeof data?.videoUrl !== "string" || !data.videoUrl) {
          clearVideoSource();
          setPlaybackNotice("No pudimos cargar el fallback MP4.");
          return;
        }

        setPlaybackNotice("No pudimos cargar HLS. Reproduciendo fallback MP4.");
        setVideoSource(data.videoUrl);
      } catch {
        if (!cancelled) {
          clearVideoSource();
          setPlaybackNotice("No pudimos cargar el fallback MP4.");
        }
      }
    };

    setPlaybackNotice(null);

    if (playbackType !== "hls" || !hlsSrc) {
      const mediaElement = video;
      let lastRefreshAt = 0;
      let refreshing = false;
      const REFRESH_COOLDOWN_MS = 30_000;

      const refreshMp4 = async () => {
        if (cancelled || refreshing) return;
        if (!mp4FallbackUrlEndpoint) {
          setPlaybackNotice("No pudimos cargar el video.");
          return;
        }
        const now = Date.now();
        if (lastRefreshAt && now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
          setPlaybackNotice("No pudimos cargar el video. Probá recargar la página.");
          return;
        }
        refreshing = true;
        lastRefreshAt = now;

        const savedTime = mediaElement.currentTime || 0;
        const wasPlaying = !mediaElement.paused && !mediaElement.ended;

        try {
          const response = await fetch(mp4FallbackUrlEndpoint, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          });

          if (cancelled) return;

          if (response.status === 401 || response.status === 403) {
            showAuthorizationError();
            return;
          }

          if (!response.ok) {
            setPlaybackNotice("No pudimos renovar el video.");
            return;
          }

          const data = (await response.json().catch(() => null)) as {
            videoUrl?: unknown;
          } | null;

          if (cancelled) return;

          if (typeof data?.videoUrl !== "string" || !data.videoUrl) {
            setPlaybackNotice("No pudimos renovar el video.");
            return;
          }

          const onReady = () => {
            mediaElement.removeEventListener("loadedmetadata", onReady);
            if (cancelled) return;
            try {
              mediaElement.currentTime = Math.max(0, savedTime - 1);
            } catch {
              // Ignorar si el browser no permite seek inmediato.
            }
            if (wasPlaying) {
              void mediaElement.play().catch(() => {
                // Autoplay puede ser bloqueado; el usuario podrá darle play manual.
              });
            }
          };

          mediaElement.addEventListener("loadedmetadata", onReady, { once: true });
          setPlaybackNotice(null);
          setVideoSource(data.videoUrl);
        } catch {
          if (!cancelled) {
            setPlaybackNotice("No pudimos renovar el video.");
          }
        } finally {
          refreshing = false;
        }
      };

      const onMp4Error = () => {
        if (cancelled) return;
        void refreshMp4();
      };

      if (mp4Src) {
        mediaElement.addEventListener("error", onMp4Error);
        setVideoSource(mp4Src);
      } else {
        clearVideoSource();
      }

      return () => {
        cancelled = true;
        mediaElement.removeEventListener("error", onMp4Error);
      };
    }

    const hlsSource = hlsSrc;
    const mediaElement = video;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const onNativeError = () => {
        if (cancelled) return;
        video.removeEventListener("error", onNativeError);
        void loadMp4Fallback("No pudimos cargar HLS nativo.");
      };

      const setupNativeHls = async () => {
        try {
          const response = await fetch(hlsSource, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
          });

          if (cancelled) return;

          if (response.status === 401 || response.status === 403) {
            showAuthorizationError();
            return;
          }

          if (!response.ok) {
            void loadMp4Fallback(
              `No pudimos cargar HLS. Status: ${response.status}.`
            );
            return;
          }

          mediaElement.addEventListener("error", onNativeError);
          setVideoSource(hlsSource);
        } catch {
          if (!cancelled) {
            void loadMp4Fallback("No pudimos cargar HLS nativo.");
          }
        }
      };

      void setupNativeHls();

      return () => {
        cancelled = true;
        mediaElement.removeEventListener("error", onNativeError);
      };
    }

    async function setupHlsJs() {
      try {
        const HlsConstructor = (await import("hls.js")).default;
        if (cancelled) return;

        if (!HlsConstructor.isSupported()) {
          void loadMp4Fallback("HLS no está soportado en este navegador.");
          return;
        }

        hls = new HlsConstructor();
        hls.on(HlsConstructor.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          const statusCode = getHlsStatusCode(data);
          hls?.destroy();
          hls = null;

          if (statusCode === 401 || statusCode === 403) {
            showAuthorizationError();
            return;
          }

          void loadMp4Fallback(
            statusCode
              ? `No pudimos cargar HLS. Status: ${statusCode}.`
              : "No pudimos cargar HLS."
          );
        });
        hls.loadSource(hlsSource);
        hls.attachMedia(mediaElement);
      } catch {
        if (!cancelled) {
          void loadMp4Fallback("No pudimos inicializar HLS.");
        }
      }
    }

    void setupHlsJs();

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [allowMp4Fallback, currentModuleId, hlsSrc, mp4FallbackUrlEndpoint, mp4Src, playbackType]);

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
  }, [currentModuleId, initialWatchedSeconds]);

  // Persistir progreso cada 10s mientras se reproduce.
  useEffect(() => {
    if (isAuthorPreview) return;
    const video = videoRef.current;
    if (!video) return;

    let lastSent = 0;

    const sendProgress = async (completedFlag = false, keepalive = false) => {
      const seconds = Math.floor(video.currentTime || 0);
      if (!completedFlag && seconds === lastSent) return;
      lastSent = seconds;
      setProgressByModule((current) => ({
        ...current,
        [currentModuleId]: {
          watchedSeconds: seconds,
          completed: Boolean(current[currentModuleId]?.completed || completedFlag),
        },
      }));
      try {
        const res = await fetch(`/api/courses/${courseId}/progress`, {
          method: "POST",
          keepalive,
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
          if (data?.completed) {
            setProgressByModule((current) => ({
              ...current,
              [currentModuleId]: {
                watchedSeconds: seconds,
                completed: true,
              },
            }));
          }
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
    const flushProgress = () => {
      void sendProgress(false, true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushProgress();
    };

    video.addEventListener("ended", onEnded);
    video.addEventListener("pause", onPause);
    window.addEventListener("pagehide", flushProgress);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      flushProgress();
      clearInterval(interval);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("pause", onPause);
      window.removeEventListener("pagehide", flushProgress);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [courseId, currentModuleId, isAuthorPreview]);

  if (!currentModule) return null;

  const jumpToSecond = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.currentTime = Math.max(0, seconds);
      void video.play().catch(() => undefined);
    } catch {
      // Si el browser todavía no cargó metadata, el usuario puede reintentar.
    }
  };

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
            {hlsSrc || mp4Src ? (
              <video
                ref={videoRef}
                controls
                controlsList="nodownload"
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-black px-6 text-center text-sm font-semibold text-white/80">
                {videoUnavailableMessage && hlsProcessingStatusEndpoint ? (
                  <HlsProcessingPlaceholder
                    initialMessage={videoUnavailableMessage}
                    statusEndpoint={hlsProcessingStatusEndpoint}
                  />
                ) : (
                  videoUnavailableMessage ??
                  "Este módulo todavía no tiene video cargado."
                )}
              </div>
            )}
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
          {playbackNotice && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
              {playbackNotice}
            </p>
          )}

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

          <MaterialQuestionsPanel
            targetType="course"
            courseId={courseId}
            currentModuleId={currentModuleId}
            currentSeconds={currentSecond}
            onJumpToSeconds={jumpToSecond}
            surface="embedded"
            className="mt-7 max-w-4xl"
          />
        </div>

        <aside className="lg:w-80 lg:shrink-0">
          <div className="rounded-[24px] border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f1e1a]">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Módulos del curso
            </p>
            <ul className="space-y-1">
              {modules.map((courseModule) => {
                const active = courseModule.id === currentModuleId;
                const moduleProgressState = progressByModule[courseModule.id];
                const progressPct = moduleProgressState?.completed
                  ? 100
                  : courseModule.duration_seconds > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((moduleProgressState?.watchedSeconds ?? 0) /
                            courseModule.duration_seconds) *
                            100
                        )
                      )
                    : 0;
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
                          moduleProgressState?.completed
                            ? "bg-green-600 text-white dark:bg-green-400 dark:text-[#071713]"
                            : active
                            ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                            : "bg-gray-100 text-muted-foreground dark:bg-white/[0.06]"
                        }`}
                      >
                        {moduleProgressState?.completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          courseModule.position
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {courseModule.title}
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{formatDuration(courseModule.duration_seconds)}</span>
                          {progressPct > 0 && <span>{progressPct}%</span>}
                        </span>
                        {progressPct > 0 && (
                          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                            <span
                              className="block h-full rounded-full bg-accent-600 dark:bg-accent-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </span>
                        )}
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
