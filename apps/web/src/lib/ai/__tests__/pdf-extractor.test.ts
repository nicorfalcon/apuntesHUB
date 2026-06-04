import { describe, it, expect, beforeEach, vi } from "vitest";

// extractPdfPages delega el parseo real en `unpdf` (PDF.js). Mockeamos ese
// módulo para verificar el cableado: que pida páginas separadas (mergePages:false)
// y arme pageNumber 1-based + fullText.
const h = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

vi.mock("unpdf", () => ({
  getDocumentProxy: h.getDocumentProxy,
  extractText: h.extractText,
}));

import { extractPdfPages, extractPdfText } from "../pdf-extractor";

describe("extractPdfPages", () => {
  beforeEach(() => {
    h.getDocumentProxy.mockReset();
    h.extractText.mockReset();
  });

  it("devuelve páginas con pageNumber 1-based y arma fullText", async () => {
    const fakePdf = { numPages: 2 };
    h.getDocumentProxy.mockResolvedValue(fakePdf);
    h.extractText.mockResolvedValue({
      totalPages: 2,
      text: ["Primera página", "Segunda página"],
    });

    const buffer = new TextEncoder().encode("%PDF-1.4 ...").buffer;
    const result = await extractPdfPages(buffer);

    expect(result.pageCount).toBe(2);
    expect(result.pages).toEqual([
      { pageNumber: 1, text: "Primera página" },
      { pageNumber: 2, text: "Segunda página" },
    ]);
    expect(result.fullText).toBe("Primera página\n\nSegunda página");

    // Pide páginas separadas, no fusionadas.
    expect(h.extractText).toHaveBeenCalledWith(fakePdf, { mergePages: false });
    // Convierte el ArrayBuffer a Uint8Array antes de pasarlo al parser.
    const [bytesArg] = h.getDocumentProxy.mock.calls[0];
    expect(bytesArg).toBeInstanceOf(Uint8Array);
  });

  it("preserva páginas vacías para no desalinear la numeración 1-based", async () => {
    h.getDocumentProxy.mockResolvedValue({});
    h.extractText.mockResolvedValue({
      totalPages: 3,
      text: ["Hola", "", "Mundo"],
    });

    const result = await extractPdfPages(new ArrayBuffer(8));

    expect(result.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(result.pages[1]).toEqual({ pageNumber: 2, text: "" });
    // fullText omite las vacías.
    expect(result.fullText).toBe("Hola\n\nMundo");
  });

  it("loguea un warning cuando el texto extraído es casi nulo", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    h.getDocumentProxy.mockResolvedValue({});
    h.extractText.mockResolvedValue({ totalPages: 1, text: [""] });

    const result = await extractPdfPages(new ArrayBuffer(0));

    expect(result.fullText).toBe("");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("texto extraído casi nulo"),
      expect.objectContaining({ pageCount: 1 })
    );
    warnSpy.mockRestore();
  });

  it("propaga el error si el parser falla", async () => {
    h.getDocumentProxy.mockRejectedValue(new Error("invalid pdf"));
    await expect(extractPdfPages(new ArrayBuffer(8))).rejects.toThrow("invalid pdf");
  });
});

describe("extractPdfText (compat)", () => {
  beforeEach(() => {
    h.getDocumentProxy.mockReset();
    h.extractText.mockReset();
  });

  it("devuelve solo el fullText fusionado", async () => {
    h.getDocumentProxy.mockResolvedValue({});
    h.extractText.mockResolvedValue({ totalPages: 2, text: ["uno", "dos"] });

    expect(await extractPdfText(new ArrayBuffer(4))).toBe("uno\n\ndos");
  });
});
