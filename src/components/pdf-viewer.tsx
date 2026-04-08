import dynamic from "next/dynamic";

// Carga el visor SOLO en el cliente para evitar que pdf.js rompa el SSR
// (pdf.js usa `window`, `Object.defineProperty` sobre globals del browser, etc.)
const PdfViewerClient = dynamic(
  () =>
    import("./pdf-viewer-client").then((mod) => ({ default: mod.PdfViewerClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="w-full h-[80vh] bg-gray-100 border border-gray-200 rounded-lg shadow-inner flex items-center justify-center">
          <div role="status" aria-label="Cargando visor seguro" className="flex flex-col items-center gap-3">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            <p className="text-sm text-gray-500">Cargando visor seguro...</p>
          </div>
        </div>
      </div>
    ),
  }
);

interface PdfViewerProps {
  apunteId: string;
  userEmail: string;
}

export function PdfViewer({ apunteId, userEmail }: PdfViewerProps) {
  return <PdfViewerClient apunteId={apunteId} userEmail={userEmail} />;
}
