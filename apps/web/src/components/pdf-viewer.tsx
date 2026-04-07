"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker de PDF.js — necesario para react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  apunteId: string;
  userEmail: string;
}

export function PdfViewer({ apunteId, userEmail }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar PDF como blob desde la API (no se expone URL directa)
  useEffect(() => {
    async function loadPdf() {
      try {
        const res = await fetch(`/api/pdf/${apunteId}`);
        if (!res.ok) throw new Error("No se pudo cargar el PDF");
        const buffer = await res.arrayBuffer();
        setPdfData(buffer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    loadPdf();
  }, [apunteId]);

  // Anti-piratería: bloquear Ctrl+P (imprimir) y Ctrl+S (guardar)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "s")) {
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

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const goToPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goToNext = () => setPageNumber((p) => Math.min(numPages, p + 1));

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
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
        className="pdf-viewer-container relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        {/* Watermark dinámico superpuesto */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-wrap items-center justify-center gap-16 overflow-hidden p-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-lg font-semibold text-gray-300/40 md:text-xl"
              style={{ transform: `rotate(-30deg)` }}
            >
              {userEmail}
            </span>
          ))}
        </div>

        {pdfData && (
          <Document
            file={{ data: pdfData }}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex h-96 w-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={Math.min(700, typeof window !== "undefined" ? window.innerWidth - 80 : 700)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}
      </div>
    </div>
  );
}
