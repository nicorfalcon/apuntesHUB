"use client";

import { useEffect, useRef, useState } from "react";

interface PdfViewerProps {
  apunteId: string;
  userEmail: string;
}

export function PdfViewer({ apunteId, userEmail }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // ANTI-PIRATERÍA: bloquear Ctrl+P, Ctrl+S, Ctrl+U, F12
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const blocked =
        (e.ctrlKey || e.metaKey) &&
        ["p", "s", "u"].includes(e.key.toLowerCase());
      const isF12 = e.key === "F12";
      if (blocked || isF12) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // ANTI-PIRATERÍA: bloquear clic derecho en el contenedor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Contenedor del visor con protecciones */}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* WATERMARK dinámico con email del usuario */}
        <div
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          aria-hidden="true"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute whitespace-nowrap text-sm font-semibold text-gray-400/30 select-none"
              style={{
                top: `${(i % 4) * 25 + 5}%`,
                left: `${Math.floor(i / 4) * 33 + 2}%`,
                transform: "rotate(-35deg)",
                fontSize: "13px",
                letterSpacing: "0.05em",
              }}
            >
              {userEmail}
            </span>
          ))}
        </div>

        {/* Overlay transparente que bloquea interacción directa con el iframe */}
        <div
          className="absolute inset-0 z-10"
          style={{ background: "transparent" }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Spinner mientras carga */}
        {!loaded && !error && (
          <div className="flex h-[75vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex h-[75vh] items-center justify-center text-sm text-red-500">
            No se pudo cargar el documento.
          </div>
        )}

        {/* Iframe — carga el PDF desde la API, nunca URL directa */}
        <iframe
          src={`/api/pdf/${apunteId}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
          className="w-full"
          style={{
            height: "75vh",
            display: loaded ? "block" : "none",
            border: "none",
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          title="Visor de apunte"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* Nota de protección */}
      <p className="text-xs text-gray-400 text-center">
        Este documento está protegido. Queda prohibida su reproducción o distribución.
      </p>
    </div>
  );
}
