import { getDocumentProxy, extractText } from "unpdf";
import { resolve } from "path";
import { pathToFileURL } from "url";

// Necesario para PDFs con fuentes no estándar (p.ej. apuntes de iPad).
// outputFileTracingIncludes en next.config.mjs asegura que los cmaps
// estén presentes en el bundle de Vercel.
function getCMapUrl(): string {
  try {
    const cmapsDir = resolve(process.cwd(), "node_modules/pdfjs-dist/cmaps");
    return pathToFileURL(cmapsDir).href + "/";
  } catch {
    return "";
  }
}

export async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const cMapUrl = getCMapUrl();
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer), {
    ...(cMapUrl ? { cMapUrl, cMapPacked: true } : {}),
  });
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}