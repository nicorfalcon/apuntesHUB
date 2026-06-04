import { describe, it, expect } from "vitest";
import {
  deriveChunkTerms,
  MAX_CHUNK_TERMS,
  MAX_CHUNK_TERM_LENGTH,
} from "../chunk-terms";

describe("deriveChunkTerms", () => {
  it("devuelve [] cuando no hay chunks", () => {
    expect(deriveChunkTerms([])).toEqual([]);
  });

  it("no rompe ni indexa nada si un apunte no tiene contenido aprovechable", () => {
    expect(deriveChunkTerms([null, undefined, "", "   "])).toEqual([]);
  });

  it("encuentra 'le chatelier' aunque aparezca una sola vez en un chunk", () => {
    const terms = deriveChunkTerms([
      "El principio de Le Châtelier describe el equilibrio químico.",
    ]);
    expect(terms).toContain("le chatelier");
  });

  it("captura conceptos multi-palabra útiles y normaliza acentos", () => {
    const terms = deriveChunkTerms([
      "El Principio de Le Châtelier y la constante de equilibrio en cinética química. " +
        "El equilibrio químico depende de la constante de equilibrio.",
    ]);
    expect(terms).toContain("le chatelier");
    expect(terms).toContain("equilibrio quimico");
    expect(terms).toContain("constante de equilibrio");
    // Sin acentos en ningún término.
    expect(terms.every((t) => t === t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).toBe(
      true
    );
  });

  it("no indexa contenido completo: cada término es corto", () => {
    const longParagraph =
      "Este es un párrafo extenso con muchísimas palabras que jamás debería " +
      "guardarse completo en el índice porque expondría contenido del PDF y " +
      "violaría las reglas de seguridad de la PoC de búsqueda pública.";
    const terms = deriveChunkTerms([longParagraph]);
    for (const term of terms) {
      expect(term.length).toBeLessThanOrEqual(MAX_CHUNK_TERM_LENGTH);
    }
    // No debe contener el párrafo completo.
    expect(terms).not.toContain(longParagraph.toLowerCase());
  });

  it("limita la cantidad de términos a MAX_CHUNK_TERMS", () => {
    const words = Array.from({ length: 400 }, (_, i) => `concepto${i}`);
    // Repetimos para superar el umbral de frecuencia de unigramas.
    const content = `${words.join(" ")} ${words.join(" ")}`;
    const terms = deriveChunkTerms([content]);
    expect(terms.length).toBeLessThanOrEqual(MAX_CHUNK_TERMS);
  });

  it("deduplica términos repetidos", () => {
    const terms = deriveChunkTerms([
      "equilibrio quimico equilibrio quimico equilibrio quimico",
      "equilibrio quimico otra vez equilibrio quimico",
    ]);
    const unique = new Set(terms);
    expect(unique.size).toBe(terms.length);
    expect(terms).toContain("equilibrio quimico");
  });

  it("descarta términos puramente genéricos/stopwords", () => {
    const terms = deriveChunkTerms([
      "apunte resumen parcial final unidad de la el los las",
    ]);
    expect(terms).not.toContain("apunte");
    expect(terms).not.toContain("resumen");
    expect(terms).not.toContain("de la");
  });
});
