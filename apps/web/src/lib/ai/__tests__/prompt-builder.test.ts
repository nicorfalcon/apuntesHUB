import { describe, it, expect } from "vitest";
import { buildEnrichedPrompt, parseSourcesFromResponse } from "../prompt-builder";
import type { WebResult } from "@/lib/search/web-search";

describe("buildEnrichedPrompt", () => {
  it("incluye la pregunta del usuario y el contenido del apunte en el prompt", () => {
    // given
    const pregunta = "¿Qué es la recursión?";
    const apunte = "La recursión es cuando una función se llama a sí misma.";

    // when
    const prompt = buildEnrichedPrompt(pregunta, apunte, []);

    // then
    expect(prompt).toContain(pregunta);
    expect(prompt).toContain(apunte);
  });

  it("usa el mensaje de fallback cuando no hay resultados web", () => {
    // given
    const sinWeb: WebResult[] = [];

    // when
    const prompt = buildEnrichedPrompt("pregunta", "apunte", sinWeb);

    // then
    expect(prompt).toContain("No se encontraron resultados web adicionales.");
  });

  it("numera y formatea cada resultado web con su fuente y snippet", () => {
    // given
    const webResults: WebResult[] = [
      { source: "Wikipedia", snippet: "Definición A", url: "https://a.com" } as WebResult,
      { source: "MDN", snippet: "Definición B", url: "https://b.com" } as WebResult,
    ];

    // when
    const prompt = buildEnrichedPrompt("pregunta", "apunte", webResults);

    // then
    expect(prompt).toContain("[Fuente web 1 - Wikipedia]\nDefinición A");
    expect(prompt).toContain("[Fuente web 2 - MDN]\nDefinición B");
  });
});

describe("parseSourcesFromResponse", () => {
  describe("cuando la respuesta no tiene el marcador FUENTES_JSON", () => {
    it("devuelve el texto recortado y la fuente del apunte por defecto", () => {
      // given
      const respuesta = "  Esta es la respuesta sin fuentes.  ";

      // when
      const result = parseSourcesFromResponse(respuesta);

      // then
      expect(result).toEqual({
        cleanText: "Esta es la respuesta sin fuentes.",
        sources: [{ type: "note", label: "Tu apunte" }],
      });
    });
  });

  describe("cuando la respuesta tiene el marcador con JSON válido", () => {
    it("separa el texto limpio de las fuentes parseadas", () => {
      // given
      const respuesta =
        'Respuesta con fuentes.\nFUENTES_JSON:[{"type":"note","label":"Tu apunte"},{"type":"web","label":"Wikipedia","url":"https://a.com"}]';

      // when
      const result = parseSourcesFromResponse(respuesta);

      // then
      expect(result.cleanText).toBe("Respuesta con fuentes.");
      expect(result.sources).toEqual([
        { type: "note", label: "Tu apunte" },
        { type: "web", label: "Wikipedia", url: "https://a.com" },
      ]);
    });
  });

  describe("cuando el JSON después del marcador es inválido", () => {
    it("devuelve el texto limpio pero cae al source por defecto", () => {
      // given
      const respuesta = "Respuesta.\nFUENTES_JSON:{esto no es json válido}";

      // when
      const result = parseSourcesFromResponse(respuesta);

      // then
      expect(result.cleanText).toBe("Respuesta.");
      expect(result.sources).toEqual([{ type: "note", label: "Tu apunte" }]);
    });
  });
});
