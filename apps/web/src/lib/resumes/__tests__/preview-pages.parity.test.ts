import { describe, it, expect } from "vitest";
import * as mjs from "../../../../scripts/lib/preview-rules.mjs";
import {
  resolveFreePages,
  resolveRenderedPageCount,
  detectIndexPage,
  PREVIEW_MAX_RENDERED_PAGES,
  PREVIEW_SHORT_DOC_THRESHOLD,
  PREVIEW_MAX_FREE_RATIO,
} from "../preview-pages";

// Guarda contra desincronización entre la fuente .ts (testeada) y la réplica .mjs
// que usa el worker de previews en runtime. Si alguien cambia una sin la otra, falla.

describe("paridad preview-rules.mjs ↔ preview-pages.ts", () => {
  it("expone las mismas constantes", () => {
    expect(mjs.PREVIEW_MAX_RENDERED_PAGES).toBe(PREVIEW_MAX_RENDERED_PAGES);
    expect(mjs.PREVIEW_SHORT_DOC_THRESHOLD).toBe(PREVIEW_SHORT_DOC_THRESHOLD);
    expect(mjs.PREVIEW_MAX_FREE_RATIO).toBe(PREVIEW_MAX_FREE_RATIO);
  });

  it("resolveFreePages coincide en 0..250", () => {
    for (let n = 0; n <= 250; n += 1) {
      expect(mjs.resolveFreePages(n)).toEqual(resolveFreePages(n));
    }
    expect(mjs.resolveFreePages(NaN)).toEqual(resolveFreePages(NaN));
    expect(mjs.resolveFreePages(-3)).toEqual(resolveFreePages(-3));
  });

  it("resolveRenderedPageCount coincide en 0..250", () => {
    for (let n = 0; n <= 250; n += 1) {
      expect(mjs.resolveRenderedPageCount(n)).toBe(resolveRenderedPageCount(n));
    }
  });

  it("detectIndexPage coincide en casos representativos", () => {
    const cases: string[][] = [
      ["Portada", "Índice\n1. Intro", "cuerpo"],
      ["TEMARIO"],
      ["El contenido de la clase abarca..."],
      ["a", "b", "c"],
      ["", "", "", "", "", "Índice tardío"],
      ["Sumario de la unidad"],
      ["Tabla de contenidos"],
    ];
    for (const c of cases) {
      expect(mjs.detectIndexPage(c)).toBe(detectIndexPage(c));
    }
  });
});
