import { describe, it, expect, beforeEach, vi } from "vitest";

// extractPdfText delega el parseo real en `unpdf` (dependencia externa, motor de
// PDF.js). Mockeamos ese módulo para verificar el cableado de la unidad: que pase
// el buffer a getDocumentProxy y devuelva el texto fusionado de extractText.
const h = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

vi.mock("unpdf", () => ({
  getDocumentProxy: h.getDocumentProxy,
  extractText: h.extractText,
}));

import { extractPdfText } from "../pdf-extractor";

describe("extractPdfText", () => {
  beforeEach(() => {
    h.getDocumentProxy.mockReset();
    h.extractText.mockReset();
  });

  it("dado un PDF, entonces devuelve el texto fusionado de todas las páginas", async () => {
    const fakePdf = { numPages: 2 };
    h.getDocumentProxy.mockResolvedValue(fakePdf);
    h.extractText.mockResolvedValue({ text: "hola mundo" });

    const buffer = new TextEncoder().encode("%PDF-1.4 ...").buffer;
    const result = await extractPdfText(buffer);

    expect(result).toBe("hola mundo");
    // Convierte el ArrayBuffer a Uint8Array antes de pasarlo al parser.
    const [bytesArg] = h.getDocumentProxy.mock.calls[0];
    expect(bytesArg).toBeInstanceOf(Uint8Array);
    // Pide la fusión de páginas en una sola cadena.
    expect(h.extractText).toHaveBeenCalledWith(fakePdf, { mergePages: true });
  });

  it("dado un PDF sin texto, entonces devuelve cadena vacía", async () => {
    h.getDocumentProxy.mockResolvedValue({});
    h.extractText.mockResolvedValue({ text: "" });

    expect(await extractPdfText(new ArrayBuffer(0))).toBe("");
  });

  it("dado que el parser falla, entonces propaga el error", async () => {
    h.getDocumentProxy.mockRejectedValue(new Error("invalid pdf"));

    await expect(extractPdfText(new ArrayBuffer(8))).rejects.toThrow(
      "invalid pdf"
    );
  });
});
