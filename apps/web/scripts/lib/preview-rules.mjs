// Réplica en .mjs (sin side-effects, importable) de src/lib/resumes/preview-pages.ts.
// El worker de previews la importa en runtime; el .ts es la fuente testeada con Vitest.
// El test de paridad (src/lib/resumes/__tests__/preview-pages.parity.test.ts) verifica
// que ambas copias produzcan resultados idénticos, así no se desincronizan.
//
// Existe una copia separada porque un script .mjs ejecutado con `node` no puede
// importar un módulo .ts sin un paso de build.

export const PREVIEW_MAX_RENDERED_PAGES = 20;
export const PREVIEW_SHORT_DOC_THRESHOLD = 4;
export const PREVIEW_MAX_FREE_RATIO = 0.25;

const INDEX_HEADING_RE =
  /\b(indice|tabla de contenidos?|contenidos|temario|sumario)\b/;

export function resolveFreePages(totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return [];
  const rendered = Math.min(totalPages, PREVIEW_MAX_RENDERED_PAGES);
  if (rendered <= PREVIEW_SHORT_DOC_THRESHOLD) return [];
  const cap = Math.max(1, Math.floor(rendered * PREVIEW_MAX_FREE_RATIO));
  const candidates = [1, 2, Math.ceil(rendered / 2)];
  return Array.from(new Set(candidates))
    .sort((a, b) => a - b)
    .slice(0, cap);
}

export function resolveRenderedPageCount(totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 0;
  return Math.min(totalPages, PREVIEW_MAX_RENDERED_PAGES);
}

function normalizeForMatch(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function detectIndexPage(pageTexts, maxScan = 5, headChars = 150) {
  const scan = Math.min(maxScan, pageTexts.length);
  for (let i = 0; i < scan; i += 1) {
    const head = normalizeForMatch(pageTexts[i] ?? "").slice(0, headChars);
    if (INDEX_HEADING_RE.test(head)) return i + 1;
  }
  return null;
}
