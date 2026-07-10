import { describe, it, expect } from "vitest";
import {
  resolveFreePages,
  resolveRenderedPageCount,
  detectIndexPage,
  isPageLocked,
  PREVIEW_MAX_RENDERED_PAGES,
  PREVIEW_SHORT_DOC_THRESHOLD,
} from "../preview-pages";

describe("resolveFreePages", () => {
  it("devuelve vacío para 0 o entradas inválidas", () => {
    expect(resolveFreePages(0)).toEqual([]);
    expect(resolveFreePages(NaN)).toEqual([]);
    expect(resolveFreePages(-5)).toEqual([]);
  });

  it("no libera páginas de contenido en documentos cortos", () => {
    // <= PREVIEW_SHORT_DOC_THRESHOLD → ninguna nítida (el índice lo agrega el worker)
    expect(resolveFreePages(1)).toEqual([]);
    expect(resolveFreePages(2)).toEqual([]);
    expect(resolveFreePages(3)).toEqual([]);
    expect(resolveFreePages(PREVIEW_SHORT_DOC_THRESHOLD)).toEqual([]);
  });

  it("respeta el techo del 25% en documentos medianos", () => {
    // 5 → floor(5*0.25)=1 → [1]
    expect(resolveFreePages(5)).toEqual([1]);
    // 8 → floor(2)=2 → [1, 2]
    expect(resolveFreePages(8)).toEqual([1, 2]);
  });

  it("libera 1ª, 2ª y una del medio en apuntes largos", () => {
    // 12 → cap 3 → [1, 2, 6]
    expect(resolveFreePages(12)).toEqual([1, 2, 6]);
  });

  it("aplica el techo de páginas renderizadas", () => {
    // 200 → renderizadas 20 → cap 5, candidatos [1,2,10]
    expect(resolveFreePages(200)).toEqual([1, 2, 10]);
    expect(resolveFreePages(PREVIEW_MAX_RENDERED_PAGES)).toEqual([1, 2, 10]);
  });
});

describe("resolveRenderedPageCount", () => {
  it("no supera el techo", () => {
    expect(resolveRenderedPageCount(5)).toBe(5);
    expect(resolveRenderedPageCount(200)).toBe(PREVIEW_MAX_RENDERED_PAGES);
    expect(resolveRenderedPageCount(0)).toBe(0);
  });
});

describe("detectIndexPage", () => {
  it("detecta la página cuyo encabezado es un índice", () => {
    const pages = [
      "Apunte de Análisis Matemático I",
      "Índice\n1. Límites .... 3\n2. Derivadas .... 8",
      "1. Límites\nUn límite es...",
    ];
    expect(detectIndexPage(pages)).toBe(2);
  });

  it("es insensible a acentos y mayúsculas", () => {
    expect(detectIndexPage(["TEMARIO general del curso"])).toBe(1);
    expect(detectIndexPage(["INDICE"])).toBe(1);
  });

  it("no confunde 'contenido' en el cuerpo del texto con un índice", () => {
    const pages = [
      "Portada",
      "El contenido de esta clase abarca los teoremas fundamentales del cálculo, " +
        "que veremos en detalle a lo largo de las próximas secciones del apunte.",
    ];
    expect(detectIndexPage(pages)).toBeNull();
  });

  it("devuelve null si ninguna página escaneada tiene índice", () => {
    expect(detectIndexPage(["a", "b", "c"])).toBeNull();
  });

  it("no escanea más allá de maxScan", () => {
    const pages = ["", "", "", "", "", "Índice tardío"];
    expect(detectIndexPage(pages, 5)).toBeNull();
  });
});

describe("isPageLocked", () => {
  it("marca libres las páginas de la regla y bloqueadas el resto", () => {
    // 12 páginas → libres [1, 2, 6]
    expect(isPageLocked(1, 12)).toBe(false);
    expect(isPageLocked(6, 12)).toBe(false);
    expect(isPageLocked(3, 12)).toBe(true);
    // documento corto → todo bloqueado
    expect(isPageLocked(1, 3)).toBe(true);
  });
});
