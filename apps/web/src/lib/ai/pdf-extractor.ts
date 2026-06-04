import { getDocumentProxy, extractText } from "unpdf";
import { resolve } from "path";
import { pathToFileURL } from "url";

// Polyfill de Promise.try: pdfjs (vía unpdf) la usa en ciertos PDFs (fuentes no
// estándar / cmaps). Node 22 (V8 12.4) no la trae nativa, y al faltar lanza un
// TypeError sincrónico DENTRO de un microtask desprendido de pdfjs, que escapa
// al try/catch del route y se vuelve unhandledRejection: el job queda colgado en
// "processing" para siempre. Esto la define antes de cualquier extracción, con
// semántica idéntica al estándar (ejecuta fn ya y captura throws sincrónicos
// como rechazo de la promesa).
if (typeof (Promise as { try?: unknown }).try !== "function") {
  (
    Promise as unknown as {
      try: <T, A extends unknown[]>(
        fn: (...args: A) => T,
        ...args: A
      ) => Promise<Awaited<T>>;
    }
  ).try = function <T, A extends unknown[]>(
    fn: (...args: A) => T,
    ...args: A
  ): Promise<Awaited<T>> {
    return new Promise((resolve) => resolve(fn(...args) as Awaited<T>));
  };
}

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

export type ExtractedPdfPage = {
  /** 1-based: la primera página es 1, no 0. */
  pageNumber: number;
  text: string;
};

export type ExtractedPdf = {
  pages: ExtractedPdfPage[];
  /** Texto completo unido por página, para compatibilidad con M1/M2. */
  fullText: string;
  pageCount: number;
};

// Umbral por debajo del cual consideramos que la extracción fue "casi nula"
// (probable PDF escaneado sin capa de texto). No implementamos OCR todavía,
// pero dejamos un warning claro para diagnóstico.
const LOW_TEXT_THRESHOLD = 40;

/**
 * Extrae el texto de un PDF preservando la separación por página.
 * `unpdf` con `mergePages: false` devuelve un string por página (1 entrada
 * por página, incluyendo las vacías), lo que nos permite mapear pageNumber
 * 1-based de forma estable.
 */
export async function extractPdfPages(
  pdfBuffer: ArrayBuffer
): Promise<ExtractedPdf> {
  const cMapUrl = getCMapUrl();
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer), {
    ...(cMapUrl ? { cMapUrl, cMapPacked: true } : {}),
  });

  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  // Preservamos TODAS las páginas (incluso vacías) para no desalinear la
  // numeración 1-based. El chunker decide después qué hacer con páginas vacías.
  const pages: ExtractedPdfPage[] = (Array.isArray(text) ? text : [text]).map(
    (pageText, i) => ({
      pageNumber: i + 1,
      text: typeof pageText === "string" ? pageText : "",
    })
  );

  const pageCount =
    typeof totalPages === "number" && totalPages > 0
      ? totalPages
      : pages.length;

  const fullText = pages
    .map((p) => p.text)
    .filter((t) => t.trim().length > 0)
    .join("\n\n");

  if (fullText.trim().length < LOW_TEXT_THRESHOLD) {
    // No imprimimos contenido del PDF, solo métricas.
    console.warn(
      "[pdf-extractor] texto extraído casi nulo; posible PDF escaneado sin capa de texto (OCR no implementado todavía)",
      { pageCount, extractedChars: fullText.trim().length }
    );
  }

  return { pages, fullText, pageCount };
}

/**
 * Compatibilidad hacia atrás: devuelve solo el texto fusionado.
 * Se mantiene para callers que aún no necesitan metadata de página.
 */
export async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { fullText } = await extractPdfPages(pdfBuffer);
  return fullText;
}
