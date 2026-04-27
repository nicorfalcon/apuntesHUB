"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDeleteResumeDialogProps {
  open: boolean;
  resumeTitle: string;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteResumeDialog({
  open,
  resumeTitle,
  loading,
  error,
  onCancel,
  onConfirm,
}: ConfirmDeleteResumeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => cancelRef.current?.focus(), 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-description"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => {
          if (!loading) onCancel();
        }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-delete-title"
              className="text-base font-semibold text-foreground"
            >
              Eliminar apunte
            </h2>
            <p
              id="confirm-delete-description"
              className="mt-1 text-sm text-gray-500"
            >
              ¿Seguro que querés eliminar{" "}
              <span className="font-medium text-foreground">"{resumeTitle}"</span>?
              Dejará de estar disponible en el marketplace. Los usuarios que ya lo
              compraron mantendrán su acceso.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 disabled:opacity-60"
          >
            {loading ? "Eliminando..." : "Eliminar apunte"}
          </button>
        </div>
      </div>
    </div>
  );
}
