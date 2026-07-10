// Extracción de temas sugeridos desde un archivo PDF, del lado del navegador.
//
// Hace la parte de I/O con pdfjs (leer outline y texto de las primeras páginas)
// y delega el filtrado/limpieza al helper puro `topic-extraction`. Solo corre en
// cliente (usa el worker de pdf.js servido desde /public).

import { pdfjs } from "react-pdf";
import { detectIndexPage } from "./preview-pages";
import { suggestTopics, type OutlineTopicNode } from "./topic-extraction";

// Reusar el mismo worker estático que el visor (ver pdf-viewer.tsx).
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

const MAX_SCAN_PAGES = 8; // páginas iniciales a escanear buscando el índice
const MAX_INDEX_PAGES = 3; // páginas de índice a leer para el fallback de texto

interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

async function getPageText(
  pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>,
  pageNumber: number,
  withLineBreaks: boolean
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items as TextItemLike[]) {
    if (typeof item.str !== "string") continue;
    text += item.str + (withLineBreaks && item.hasEOL ? "\n" : " ");
  }
  return text;
}

/**
 * Núcleo de extracción a partir de los bytes del PDF. Prioriza el outline
 * (bookmarks); si no hay, cae al texto de la página de índice detectada. Nunca
 * lanza: ante cualquier error devuelve [].
 */
export async function extractTopicsFromArrayBuffer(
  data: ArrayBuffer
): Promise<string[]> {
  try {
    const pdf = await pdfjs.getDocument({ data }).promise;

    // 1) Outline (bookmarks) — fuente preferida.
    let outline: OutlineTopicNode[] = [];
    try {
      const rawOutline = await pdf.getOutline();
      if (Array.isArray(rawOutline)) {
        outline = rawOutline as unknown as OutlineTopicNode[];
      }
    } catch {
      // sin outline; seguimos con el fallback de texto
    }

    // 2) Fallback: texto de la página de índice.
    let indexText = "";
    try {
      const scan = Math.min(MAX_SCAN_PAGES, pdf.numPages);
      const firstTexts: string[] = [];
      for (let i = 1; i <= scan; i += 1) {
        firstTexts.push(await getPageText(pdf, i, false));
      }
      const indexPage = detectIndexPage(firstTexts);
      if (indexPage) {
        const parts: string[] = [];
        const last = Math.min(indexPage + MAX_INDEX_PAGES - 1, pdf.numPages);
        for (let p = indexPage; p <= last; p += 1) {
          parts.push(await getPageText(pdf, p, true));
        }
        indexText = parts.join("\n");
      }
    } catch {
      // sin texto de índice; el outline puede alcanzar
    }

    return suggestTopics({ outline, indexText });
  } catch {
    return [];
  }
}

/** Igual que {@link extractTopicsFromArrayBuffer} pero a partir de un File local. */
export async function extractTopicsFromPdfFile(file: File): Promise<string[]> {
  try {
    return await extractTopicsFromArrayBuffer(await file.arrayBuffer());
  } catch {
    return [];
  }
}
