"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Configurar worker a nivel de módulo, fuera del componente.
// El worker se sirve como archivo estático desde /public/ para que webpack
// no lo bundle.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfOutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items: PdfOutlineNode[];
}

export type TocItem = {
  title: string;
  page: number;
  items: TocItem[];
};

// Resuelve los items del outline de pdfjs a números de página
async function resolveOutlineItems(nodes: PdfOutlineNode[], pdfProxy: PDFDocumentProxy): Promise<TocItem[]> {
  const results: TocItem[] = [];
  for (const node of nodes) {
    let pageNum = 1;
    if (node.dest) {
      try {
        const dest: unknown[] | null = typeof node.dest === "string"
          ? await pdfProxy.getDestination(node.dest)
          : Array.isArray(node.dest) ? node.dest : null;
        if (dest && dest[0]) {
          const pageIndex = await pdfProxy.getPageIndex(dest[0] as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
          pageNum = pageIndex + 1;
        }
      } catch {
        // mantiene pageNum = 1 si falla la resolución
      }
    }
    const children =
      node.items?.length > 0 ? await resolveOutlineItems(node.items, pdfProxy) : [];
    results.push({ title: node.title ?? "", page: pageNum, items: children });
  }
  return results;
}

interface PdfViewerProps {
  url: string;
  userEmail: string;
  // Modo controlado: cuando se proveen estos props el toolbar interno se oculta
  // y la navegación/zoom son manejados por el componente padre.
  page?: number;
  onPageChange?: (page: number) => void;
  zoom?: number;
  onNumPagesLoad?: (numPages: number) => void;
  // Callback con el índice (outline) del PDF una vez cargado
  onOutlineLoad?: (items: TocItem[]) => void;
}

function PdfViewer({ url, userEmail, page, onPageChange, zoom, onNumPagesLoad, onOutlineLoad }: PdfViewerProps) {
  const isControlled = page !== undefined;

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  const effectivePage = isControlled ? page! : pageNumber;
  const effectiveWidth = zoom !== undefined
    ? Math.round((595 * zoom) / 100)
    : containerWidth;

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

  const onDocumentLoadSuccess = useCallback(
    async (pdfProxy: PDFDocumentProxy) => {
      setNumPages(pdfProxy.numPages);
      setError(null);
      onNumPagesLoad?.(pdfProxy.numPages);

      if (onOutlineLoad) {
        try {
          const rawOutline = await pdfProxy.getOutline();
          if (rawOutline && rawOutline.length > 0) {
            const items = await resolveOutlineItems(rawOutline as PdfOutlineNode[], pdfProxy);
            onOutlineLoad(items);
          } else {
            onOutlineLoad([]);
          }
        } catch {
          onOutlineLoad([]);
        }
      }
    },
    [onNumPagesLoad, onOutlineLoad]
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || "Error al cargar el PDF");
  }, []);

  const goToPrev = () => {
    if (isControlled) onPageChange?.(Math.max(1, page! - 1));
    else setPageNumber((p) => Math.max(1, p - 1));
  };
  const goToNext = () => {
    if (isControlled) onPageChange?.(Math.min(numPages, page! + 1));
    else setPageNumber((p) => Math.min(numPages, p + 1));
  };

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
      {/* Toolbar interno — solo en modo no controlado */}
      {!isControlled && (
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
      )}

      {/* Visor del PDF con protecciones anti-piratería */}
      <div
        ref={containerRef}
        className={`pdf-viewer-container relative overflow-hidden bg-white ${
          isControlled
            ? "rounded shadow-[0_4px_40px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]"
            : "w-full rounded-lg border border-gray-200 shadow-sm"
        }`}
        style={isControlled && zoom !== undefined ? { width: `${Math.round((595 * zoom) / 100)}px` } : undefined}
      >
        {/* Watermark dinámico superpuesto — 12 instancias con mix-blend-multiply para mayor cobertura */}
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden mix-blend-multiply opacity-[0.05]">
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
            pageNumber={effectivePage}
            width={effectiveWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}

export { PdfViewer };
export default PdfViewer;
