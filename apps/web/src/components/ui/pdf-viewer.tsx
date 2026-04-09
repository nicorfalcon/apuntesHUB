"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configurar worker a nivel de módulo, fuera del componente.
// El worker se sirve como archivo estático desde /public/ para que webpack
// no lo bundle.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
  userEmail: string;
}

export function PdfViewer({ url, userEmail }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  // Anti-piratería: bloquear Ctrl+P, Ctrl+S, Ctrl+U y F12
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const blockedCombo =
        (e.ctrlKey || e.metaKey) &&
        ["p", "s", "u"].includes(e.key.toLowerCase());
      if (blockedCombo || e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Anti-piratería: bloquear clic derecho sobre el visor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    container.addEventListener("contextmenu", handleContextMenu);
    return () => container.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Ancho responsive via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || "Error al cargar el PDF");
  }, []);

  const goToPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goToNext = () => setPageNumber((p) => Math.min(numPages, p + 1));

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setPageNumber(1);
            setRetryKey((k) => k + 1);
          }}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Controles de navegación */}
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2">
        <button
          onClick={goToPrev}
          disabled={pageNumber <= 1}
          className="rounded px-3 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          ← Anterior
        </button>
        <span className="text-sm text-gray-500">
          Página <span className="font-semibold text-foreground">{pageNumber}</span> de{" "}
          <span className="font-semibold text-foreground">{numPages}</span>
        </span>
        <button
          onClick={goToNext}
          disabled={pageNumber >= numPages}
          className="rounded px-3 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          Siguiente →
        </button>
      </div>

      {/* Visor del PDF con protecciones anti-piratería */}
      <div
        ref={containerRef}
        className="pdf-viewer-container relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        {/* Watermark dinámico superpuesto — 12 instancias con mix-blend-multiply para mayor cobertura */}
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden mix-blend-multiply opacity-40">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute whitespace-nowrap text-lg font-bold text-gray-400 select-none"
              style={{
                top: `${(i % 4) * 25 + 5}%`,
                left: `${Math.floor(i / 4) * 34}%`,
                transform: "rotate(-35deg)",
              }}
            >
              {userEmail}
            </span>
          ))}
        </div>

        {/* pdfjs maneja la descarga internamente — pasar la URL directamente
            evita el "Cannot perform Construct on a detached ArrayBuffer" que
            ocurre cuando React StrictMode re-ejecuta un efecto y el ArrayBuffer
            pre-descargado ya fue consumido/transferido por pdfjs. */}
        <Document
          key={retryKey}
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex h-96 w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}
