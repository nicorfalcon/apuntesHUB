"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Mientras la preview se está generando (el cron corre cada 10 min), reconsultamos
 * para que la página se actualice sola en vez de exigir un refresh manual. */
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 40; // ~10 minutos; después dejamos de insistir.

interface PreviewPage {
  page: number;
  url: string | null;
  locked: boolean;
  w: number | null;
  h: number | null;
}

interface PreviewResponse {
  status: "none" | "pending" | "processing" | "ready" | "failed";
  pageCount: number;
  pages: PreviewPage[];
}

interface PreviewViewerProps {
  resumeId: string;
  /** Si el usuario ya compró (o es el dueño), no tiene sentido mostrar candados. */
  unlocked?: boolean;
}

export function PreviewViewer({ resumeId, unlocked = false }: PreviewViewerProps) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState(false);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());

  // Las URLs de las páginas son firmadas y vencen. Si una imagen falla al cargar,
  // lo más probable es que la firma haya expirado (pestaña abierta un buen rato),
  // así que pedimos URLs frescas una vez antes de darla por perdida.
  const cancelledRef = useRef(false);
  const retriedSignaturesRef = useRef(false);

  const load = useCallback(async (): Promise<PreviewResponse | null> => {
    try {
      const res = await fetch(`/api/pdf/${resumeId}/preview`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const json: PreviewResponse = await res.json();
      if (!cancelledRef.current) {
        setData(json);
        setError(false);
      }
      return json;
    } catch {
      if (!cancelledRef.current) setError(true);
      return null;
    }
  }, [resumeId]);

  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    const tick = async () => {
      const json = await load();
      if (cancelledRef.current) return;
      // Solo seguimos consultando mientras el worker todavía la está generando.
      const stillWorking =
        json?.status === "pending" || json?.status === "processing";
      if (stillWorking && polls < MAX_POLLS) {
        polls += 1;
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  const handleImageError = useCallback(
    async (page: number) => {
      if (!retriedSignaturesRef.current) {
        retriedSignaturesRef.current = true;
        const json = await load();
        // Con URLs nuevas, limpiamos los fallos para que los <img> reintenten.
        if (json && !cancelledRef.current) {
          setFailedPages(new Set());
          return;
        }
      }
      if (!cancelledRef.current) {
        setFailedPages((prev) => new Set(prev).add(page));
      }
    },
    [load]
  );

  // Sin preview lista todavía: placeholder sobrio.
  if (error || (data && data.status !== "ready") || (data && data.pages.length === 0)) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-white/10 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-400">
          {data?.status === "pending" || data?.status === "processing"
            ? "Vista previa en preparación…"
            : "Vista previa no disponible"}
        </p>
      </div>
    );
  }

  // Loading
  if (!data) {
    return (
      <Skeleton tone="none" className="h-40 w-full rounded-xl border border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/[0.04]" />
    );
  }

  // Para el dueño o quien ya compró no tiene sentido mostrar las páginas bloqueadas
  // (que son baja-res, ilegibles): solo se muestran las libres como muestra nítida.
  // El apunte completo lo obtienen desde "Mi biblioteca".
  const visiblePages = unlocked
    ? data.pages.filter((p) => !p.locked)
    : data.pages;

  if (visiblePages.length === 0) {
    return null;
  }

  return (
    <section aria-label="Vista previa del apunte" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Vista previa</h2>
        <span className="text-xs text-gray-400">
          {visiblePages.length} página{visiblePages.length === 1 ? "" : "s"} de muestra
        </span>
      </div>

      <div
        className="space-y-4 select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {visiblePages.map((p) => {
          const showLock = p.locked && !unlocked;
          return (
            <div
              key={p.page}
              className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.02]"
              // Reserva el espacio antes de que cargue la imagen (evita layout shift).
              style={p.w && p.h ? { aspectRatio: `${p.w} / ${p.h}` } : undefined}
            >
              {p.url && !failedPages.has(p.page) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={`Página ${p.page}`}
                  draggable={false}
                  onError={() => void handleImageError(p.page)}
                  className={`h-full w-full object-contain ${showLock ? "blur-md scale-105" : ""}`}
                />
              ) : (
                // Sin URL o la imagen falló al cargar: placeholder etiquetado en vez
                // del ícono de imagen rota + alt suelto.
                <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100 dark:bg-white/[0.04]">
                  <span className="text-xs text-gray-400">Página {p.page}</span>
                </div>
              )}

              {showLock && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[2px] dark:bg-black/45">
                  <Lock className="h-6 w-6 text-gray-500 dark:text-sand-200/80" />
                  <a
                    href="#comprar"
                    className="rounded-full bg-accent-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                  >
                    Comprá para desbloquear
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
