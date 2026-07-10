// Fuente única de verdad para qué páginas de un apunte se muestran "libres" (nítidas)
// en la vista previa protegida y cuáles quedan "bloqueadas" (baja resolución + blur).
//
// La usan tanto el worker que renderiza las imágenes (process-pending-previews.mjs)
// como cualquier consumidor server-side, para que nunca discrepen. El worker replica
// estas funciones en .mjs; el test de paridad (preview-pages.parity.test.ts) verifica
// que no se desincronicen.

/** Máximo de páginas que se renderizan de un apunte, sin importar su largo real. */
export const PREVIEW_MAX_RENDERED_PAGES = 20;

/**
 * Umbral de "documento corto". En apuntes de pocas páginas, una sola página nítida
 * ya es una fracción grande del contenido, así que no liberamos páginas de contenido:
 * la muestra se limita al índice (que el worker agrega aparte si lo detecta).
 */
export const PREVIEW_SHORT_DOC_THRESHOLD = 4;

/** Proporción máxima del documento que se libera como muestra nítida. */
export const PREVIEW_MAX_FREE_RATIO = 0.25;

/**
 * Devuelve los números de página (1-indexados) de CONTENIDO que se muestran libres.
 * No incluye el índice: esa página la agrega el worker sobre este resultado, porque
 * requiere leer el texto del PDF (ver detectIndexPage).
 *
 * Regla:
 *   - Documentos de PREVIEW_SHORT_DOC_THRESHOLD páginas o menos: ninguna (protege
 *     apuntes cortos donde una página sería demasiado).
 *   - Documentos más largos: 1ª, 2ª y una del medio, pero nunca más del
 *     PREVIEW_MAX_FREE_RATIO del total renderizado.
 */
export function resolveFreePages(totalPages: number): number[] {
  if (!Number.isFinite(totalPages) || totalPages <= 0) {
    return [];
  }

  const rendered = Math.min(totalPages, PREVIEW_MAX_RENDERED_PAGES);

  if (rendered <= PREVIEW_SHORT_DOC_THRESHOLD) {
    return [];
  }

  const cap = Math.max(1, Math.floor(rendered * PREVIEW_MAX_FREE_RATIO));
  const candidates = [1, 2, Math.ceil(rendered / 2)];
  const unique = Array.from(new Set(candidates)).sort((a, b) => a - b);
  return unique.slice(0, cap);
}

/**
 * Cantidad de páginas que efectivamente se renderizan (libres + bloqueadas),
 * aplicando el techo.
 */
export function resolveRenderedPageCount(totalPages: number): number {
  if (!Number.isFinite(totalPages) || totalPages <= 0) {
    return 0;
  }
  return Math.min(totalPages, PREVIEW_MAX_RENDERED_PAGES);
}

// Encabezados de índice de alta precisión. Se evita el "contenido" a secas (aparece
// en texto normal) para no liberar por error una página de contenido real.
const INDEX_HEADING_RE =
  /\b(indice|tabla de contenidos?|contenidos|temario|sumario)\b/;

/** Quita acentos y pasa a minúsculas para comparar sin depender de tildes. */
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Detecta la página del índice mirando SOLO el encabezado (zona de título) de las
 * primeras páginas. Devuelve el número de página (1-indexado) o null.
 *
 * Se limita al inicio de cada página (headChars) para exigir que el término aparezca
 * como título, no perdido en el cuerpo, y así minimizar falsos positivos que
 * expondrían contenido.
 */
export function detectIndexPage(
  pageTexts: string[],
  maxScan = 5,
  headChars = 150
): number | null {
  const scan = Math.min(maxScan, pageTexts.length);
  for (let i = 0; i < scan; i += 1) {
    const head = normalizeForMatch(pageTexts[i] ?? "").slice(0, headChars);
    if (INDEX_HEADING_RE.test(head)) {
      return i + 1;
    }
  }
  return null;
}

/** True si la página dada (1-indexada) debe renderizarse bloqueada. */
export function isPageLocked(pageNumber: number, totalPages: number): boolean {
  return !resolveFreePages(totalPages).includes(pageNumber);
}
