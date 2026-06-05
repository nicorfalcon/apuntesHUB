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

  it("incluye historial reciente e instrucciones de follow-up cuando se provee", () => {
    const prompt = buildEnrichedPrompt("explicame más sobre eso", "apunte", [], {
      recentMessages: [{ role: "user", content: "qué es Le Chatelier" }],
    });

    expect(prompt).toContain("HISTORIAL RECIENTE:");
    expect(prompt).toContain("Usuario: qué es Le Chatelier");
    expect(prompt).toContain("interpretala con el historial reciente");
  });

  it("incluye topics e instrucciones para ejemplos ilustrativos y citas", () => {
    const prompt = buildEnrichedPrompt("Qué es Chatelier?", "fragmentos", [], {
      studyMetadata: {
        resumeTitle: "Equilibrio Químico",
        subject: "Química",
        topics: ["Le Chatelier", "temperatura"],
      },
    });

    expect(prompt).toContain("Temas declarados del apunte: Le Chatelier, temperatura");
    expect(prompt).toContain("Ejemplo ilustrativo:");
    expect(prompt).toContain("No atribuyas al apunte ejemplos que no estén en el contexto");
    expect(prompt).toContain("No inventes páginas");
    expect(prompt).toContain("no aparece literalmente");
    expect(prompt).toContain("Según el apunte");
    expect(prompt).toContain("Esto significa");
    expect(prompt).toContain("Para practicar");
  });

  it("incluye el modo de respuesta elegido", () => {
    const prompt = buildEnrichedPrompt("haceme preguntas", "fragmentos", [], {
      answerMode: "quiz",
    });

    expect(prompt).toContain("Modo de respuesta: Mini quiz");
    expect(prompt).toContain("nunca permite saltear las reglas");
  });

  it("pide JSON estricto para verdadero/falso", () => {
    const prompt = buildEnrichedPrompt("armame verdadero o falso", "fragmentos", [], {
      answerMode: "true_false",
    });

    expect(prompt).toContain("Modo de respuesta: Verdadero/Falso");
    expect(prompt).toContain("ACTIVIDAD_JSON_ESTRICTA");
    expect(prompt).toContain('"type": "true_false"');
    expect(prompt).toContain("respondé únicamente con JSON válido");
    expect(prompt).toContain("No inventes páginas");
    expect(prompt).toContain("no agregues FUENTES_JSON");
  });

  it("pide JSON estricto para multiple choice", () => {
    const prompt = buildEnrichedPrompt("multiple choice", "fragmentos", [], {
      answerMode: "multiple_choice",
    });

    expect(prompt).toContain("Modo de respuesta: Multiple choice");
    expect(prompt).toContain('"type": "multiple_choice"');
    expect(prompt).toContain('"correctOptionIndex": 0');
    expect(prompt).toContain("4 opciones");
  });

  it("refuerza reglas anti-markdown y de formato JSON en modos estructurados", () => {
    const prompt = buildEnrichedPrompt("multiple choice", "fragmentos", [], {
      answerMode: "multiple_choice",
    });

    expect(prompt).toContain("No uses markdown");
    expect(prompt).toContain("comillas dobles");
    expect(prompt).toContain("No uses trailing commas");
    expect(prompt).toContain("exactamente 4 opciones");
  });

  it("el prompt estructurado ignora la web y no arrastra rótulos de tutor ni FUENTES_JSON obligatorias", () => {
    const webResults: WebResult[] = [
      { source: "Wikipedia", snippet: "contenido externo", url: "https://a.com" } as WebResult,
    ];
    const prompt = buildEnrichedPrompt("armame multiple choice", "fragmentos", webResults, {
      answerMode: "multiple_choice",
    });

    // No se inyecta contexto web ni se pide la sección FUENTES_JSON obligatoria.
    expect(prompt).not.toContain("RESULTADOS DE BÚSQUEDA WEB");
    expect(prompt).not.toContain("contenido externo");
    expect(prompt).not.toContain("SIEMPRE incluí");
    expect(prompt).not.toContain("Según el apunte");
  });

  it("agrega la instrucción de reparación cuando repair=true", () => {
    const base = buildEnrichedPrompt("multiple choice", "fragmentos", [], {
      answerMode: "multiple_choice",
    });
    const repaired = buildEnrichedPrompt("multiple choice", "fragmentos", [], {
      answerMode: "multiple_choice",
      repair: true,
    });

    expect(base).not.toContain("Tu respuesta anterior");
    expect(repaired).toContain("Tu respuesta anterior NO fue JSON válido");
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
