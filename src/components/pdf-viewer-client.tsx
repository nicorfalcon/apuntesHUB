"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PdfViewerClientProps {
  apunteId: string;
  userEmail: string;
}

export function PdfViewerClient({ apunteId, userEmail }: PdfViewerClientProps) {
  const [numPages, setNumPages] = useState<number>();
  const [error, setError] = useState(false);

  // ANTI-PIRATERÍA: bloquear Ctrl+S, Ctrl+P, Ctrl+U y F12
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const blocked =
        (e.ctrlKey || e.metaKey) &&
        ["p", "s", "u"].includes(e.key.toLowerCase());
      if (blocked || e.key === "F12") {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        className="relative w-full h-[80vh] overflow-y-auto bg-gray-100 border border-gray-200 rounded-lg shadow-inner"
        onContextMenu={(e) => e.preventDefault()}
        style={{ userSelect: "none" }}
      >
        {/*
          Watermark: sticky con h-0 para no empujar el contenido.
          El div interno cubre la altura visible del contenedor.
        */}
        <div className="sticky top-0 h-0 w-full z-20 pointer-events-none overflow-visible">
          <div className="relative w-full h-[80vh] overflow-hidden mix-blend-multiply opacity-40">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute whitespace-nowrap text-lg font-bold text-gray-400 select-none"
                style={{
                  top: `${(i % 4) * 25 + 10}%`,
                  left: `${Math.floor(i / 4) * 33}%`,
                  transform: "rotate(-35deg)",
                }}
              >
                {userEmail}
              </span>
            ))}
          </div>
        </div>

        {/* Páginas del PDF renderizadas en canvas */}
        <div className="flex flex-col items-center py-4 relative z-10">
          <Document
            file={`/api/pdf/${apunteId}`}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError(true)}
            loading={
              <div className="flex items-center justify-center mt-10">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            }
          >
            {Array.from(new Array(numPages), (_, index) => (
              <div key={`page_${index + 1}`} className="mb-4 shadow-md bg-white">
                <Page
                  pageNumber={index + 1}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={800}
                />
              </div>
            ))}
          </Document>

          {error && (
            <p className="text-red-500 mt-4">Error al cargar el documento.</p>
          )}
        </div>
      </div>
    </div>
  );
}
