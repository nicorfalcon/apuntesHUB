import { describe, it, expect } from "vitest";
import {
  chunkPdfPages,
  detectHeading,
  estimateTokens,
  CHUNKING_VERSION,
  DEFAULT_CHUNK_OPTIONS,
  type PdfChunk,
} from "../pdf-chunker";
import type { ExtractedPdfPage } from "../pdf-extractor";

function page(pageNumber: number, text: string): ExtractedPdfPage {
  return { pageNumber, text };
}

describe("estimateTokens", () => {
  it("devuelve 0 para texto vacío", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("crece con la longitud del texto", () => {
    const a = estimateTokens("una frase corta");
    const b = estimateTokens("una frase corta ".repeat(50));
    expect(b).toBeGreaterThan(a);
  });
});

describe("detectHeading", () => {
  it("detecta numeración tipo 1. y 1.1", () => {
    expect(detectHeading("1. Introducción")).toBe(true);
    expect(detectHeading("1.1 Definiciones")).toBe(true);
  });

  it("detecta prefijos académicos", () => {
    expect(detectHeading("Unidad 1")).toBe(true);
    expect(detectHeading("Capítulo 2: Termodinámica")).toBe(true);
    expect(detectHeading("Tema 3")).toBe(true);
  });

  it("detecta líneas cortas en mayúsculas", () => {
    expect(detectHeading("NORMALIZACIÓN")).toBe(true);
  });

  it("no detecta líneas largas como heading", () => {
    expect(
      detectHeading(
        "Esta es una oración larga que describe un concepto en detalle y termina con punto."
      )
    ).toBe(false);
  });

  it("no detecta oraciones normales que terminan en puntuación", () => {
    expect(detectHeading("El agua hierve a cien grados.")).toBe(false);
  });
});

describe("chunkPdfPages", () => {
  it("devuelve array vacío para páginas vacías", () => {
    expect(chunkPdfPages([page(1, ""), page(2, "   ")])).toEqual([]);
  });

  it("asigna pageStart y pageEnd a cada chunk", () => {
    const chunks = chunkPdfPages([
      page(1, "Contenido de la primera página."),
      page(2, "Contenido de la segunda página."),
    ]);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(typeof c.pageStart).toBe("number");
      expect(typeof c.pageEnd).toBe("number");
      expect(c.pageStart).toBeGreaterThanOrEqual(1);
      expect(c.pageEnd).toBeGreaterThanOrEqual(c.pageStart);
    }
  });

  it("asigna chunkIndex secuencial y estable desde 0", () => {
    const longText = "Párrafo de prueba con varias palabras.\n\n".repeat(120);
    const chunks = chunkPdfPages([page(1, longText)]);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it("incluye metadata M3 esperada", () => {
    const chunks = chunkPdfPages([page(3, "Texto de ejemplo en la página tres.")]);
    const meta = chunks[0].metadata as Record<string, unknown>;
    expect(meta.source).toBe("pdf");
    expect(meta.chunkingVersion).toBe(CHUNKING_VERSION);
    expect(meta.pageStart).toBe(3);
    expect(typeof meta.estimatedTokens).toBe("number");
    expect(typeof meta.hasShortText).toBe("boolean");
  });

  it("detecta el sectionTitle y lo arrastra a los chunks", () => {
    const text = [
      "Unidad 1",
      "",
      "Primer párrafo de la unidad con contenido suficiente para un bloque.",
    ].join("\n");
    const chunks = chunkPdfPages([page(1, text)]);
    expect(chunks[0].sectionTitle).toBe("Unidad 1");
  });

  it("ningún chunk supera maxChars + overlapChars (overlap incluido en el límite)", () => {
    const longText = "palabra ".repeat(5000); // texto largo sin párrafos
    const maxChars = 1400;
    const overlapChars = 200;
    const chunks = chunkPdfPages([page(1, longText)], {
      targetChars: 1000,
      maxChars,
      overlapChars,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // El peor caso estructural es un chunk sembrado con overlap (<=overlapChars)
      // más un bloque de hasta maxChars. No debe superar esa suma.
      expect(c.charCount).toBeLessThanOrEqual(maxChars + overlapChars);
      expect(c.charCount).toBeGreaterThan(0);
    }
  });

  it("con los defaults M3, los chunks quedan dentro del límite de 512 tokens de embeddings", () => {
    // Texto académico realista con párrafos (cortes naturales).
    const paragraphs = Array.from(
      { length: 120 },
      (_, i) =>
        `Párrafo ${i}: en termodinámica, la entropía mide el desorden de un ` +
        `sistema y tiende a aumentar en procesos espontáneos según el segundo principio.`
    ).join("\n\n");

    // Sin opciones: usa DEFAULT_CHUNK_OPTIONS (calibrado a ~400 tokens).
    const chunks = chunkPdfPages([page(1, paragraphs)]);
    expect(chunks.length).toBeGreaterThan(1);

    const { maxChars, overlapChars } = DEFAULT_CHUNK_OPTIONS;
    for (const c of chunks) {
      // Estructuralmente acotado por maxChars + overlapChars.
      expect(c.charCount).toBeLessThanOrEqual(maxChars + overlapChars);
      // Y, lo importante: la estimación de tokens entra en la ventana de 512.
      // (truncate:"END" en embeddings.ts cubre cualquier borde patológico.)
      expect(estimateTokens(c.content)).toBeLessThanOrEqual(512);
    }
  });

  it("mantiene overlap entre chunks consecutivos", () => {
    const paragraphs = Array.from(
      { length: 40 },
      (_, i) => `Este es el párrafo número ${i} con bastante texto de relleno.`
    ).join("\n\n");
    const chunks = chunkPdfPages([page(1, paragraphs)], {
      targetChars: 400,
      maxChars: 600,
      overlapChars: 150,
    });
    expect(chunks.length).toBeGreaterThan(1);
    // El final de un chunk debería reaparecer al principio del siguiente.
    const tailWords = chunks[0].content.split(/\s+/).slice(-5).join(" ");
    expect(chunks[1].content).toContain(tailWords.split(" ").slice(-2).join(" "));
  });

  it("funciona con texto corto (un solo chunk, hasShortText=true)", () => {
    const chunks = chunkPdfPages([page(1, "Breve.")]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.hasShortText).toBe(true);
  });

  it("funciona con texto largo sin párrafos ni puntuación", () => {
    const noBreaks = "palabra".repeat(4000); // una sola 'palabra' gigante
    const chunks = chunkPdfPages([page(1, noBreaks)], {
      targetChars: 1000,
      maxChars: 1200,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c: PdfChunk) => c.charCount > 0)).toBe(true);
  });
});
