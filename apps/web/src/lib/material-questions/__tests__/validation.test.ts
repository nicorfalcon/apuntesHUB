import { describe, it, expect } from "vitest";
import {
  normalizeMaterialQuestionText,
  validateMaterialQuestionText,
} from "../validation";

describe("normalizeMaterialQuestionText", () => {
  it("convierte saltos de línea de Windows (\\r\\n) y Mac clásico (\\r) a \\n", () => {
    // given
    const input = "linea1\r\nlinea2\rlinea3";

    // when
    const result = normalizeMaterialQuestionText(input);

    // then
    expect(result).toBe("linea1\nlinea2\nlinea3");
  });

  it("elimina caracteres de control invisibles", () => {
    // given: NUL (0) y BELL (7) construidos con fromCharCode para que sean visibles e intencionales
    const input = "hola" + String.fromCharCode(0) + "mundo" + String.fromCharCode(7);

    // when
    const result = normalizeMaterialQuestionText(input);

    // then
    expect(result).toBe("holamundo");
  });

  it("quita los espacios y tabs que quedan antes de un salto de línea", () => {
    // given
    const input = "linea1   \nlinea2\t\nlinea3";

    // when
    const result = normalizeMaterialQuestionText(input);

    // then
    expect(result).toBe("linea1\nlinea2\nlinea3");
  });

  it("recorta los espacios al principio y al final del texto", () => {
    // given
    const input = "   texto con bordes   ";

    // when
    const result = normalizeMaterialQuestionText(input);

    // then
    expect(result).toBe("texto con bordes");
  });

  it("devuelve string vacío cuando el texto es solo espacios", () => {
    // given
    const input = "    \n\t  ";

    // when
    const result = normalizeMaterialQuestionText(input);

    // then
    expect(result).toBe("");
  });
});

describe("validateMaterialQuestionText", () => {
  const MIN = 5;
  const MAX = 20;
  const LABEL = "Pregunta";

  describe("entradas que no son texto", () => {
    it.each([
      ["número", 123],
      ["null", null],
      ["undefined", undefined],
      ["objeto", {}],
    ])("devuelve error de requerido cuando recibe un %s", (_caso, valor) => {
      // when
      const result = validateMaterialQuestionText(valor, MIN, MAX, LABEL);

      // then
      expect(result).toEqual({ value: "", error: "Pregunta requerido." });
    });
  });

  describe("validación de longitud", () => {
    it("devuelve error cuando el texto normalizado es más corto que el mínimo", () => {
      // given
      const input = "hola";

      // when
      const result = validateMaterialQuestionText(input, MIN, MAX, LABEL);

      // then
      expect(result.error).toBe("Pregunta debe tener entre 5 y 20 caracteres.");
      expect(result.value).toBe("hola");
    });

    it("devuelve error cuando el texto normalizado supera el máximo", () => {
      // given
      const input = "a".repeat(MAX + 1);

      // when
      const result = validateMaterialQuestionText(input, MIN, MAX, LABEL);

      // then
      expect(result.error).toBe("Pregunta debe tener entre 5 y 20 caracteres.");
    });

    it("acepta el texto cuando tiene exactamente el largo mínimo (límite inferior)", () => {
      // given
      const input = "a".repeat(MIN);

      // when
      const result = validateMaterialQuestionText(input, MIN, MAX, LABEL);

      // then
      expect(result).toEqual({ value: input, error: null });
    });

    it("acepta el texto cuando tiene exactamente el largo máximo (límite superior)", () => {
      // given
      const input = "a".repeat(MAX);

      // when
      const result = validateMaterialQuestionText(input, MIN, MAX, LABEL);

      // then
      expect(result).toEqual({ value: input, error: null });
    });

    it("mide la longitud sobre el texto ya normalizado, no sobre el original", () => {
      // given: 4 chars útiles rodeados de espacios que se recortan -> queda bajo el mínimo
      const input = "   hola   ";

      // when
      const result = validateMaterialQuestionText(input, MIN, MAX, LABEL);

      // then
      expect(result.error).toBe("Pregunta debe tener entre 5 y 20 caracteres.");
      expect(result.value).toBe("hola");
    });
  });

  describe("validación de saltos de línea", () => {
    it("devuelve error cuando el texto tiene más de 80 líneas", () => {
      // given: 81 líneas, dentro del rango de longitud permitido
      const input = Array.from({ length: 81 }, () => "x").join("\n");

      // when
      const result = validateMaterialQuestionText(input, 1, 1000, LABEL);

      // then
      expect(result.error).toBe("Pregunta tiene demasiados saltos de línea.");
    });

    it("acepta el texto cuando tiene exactamente 80 líneas (límite)", () => {
      // given
      const input = Array.from({ length: 80 }, () => "x").join("\n");

      // when
      const result = validateMaterialQuestionText(input, 1, 1000, LABEL);

      // then
      expect(result.error).toBeNull();
    });
  });

  describe("happy path", () => {
    it("devuelve el texto normalizado y error null cuando el input es válido", () => {
      // given
      const input = "  ¿Qué es un grafo?  ";

      // when
      const result = validateMaterialQuestionText(input, MIN, MAX, LABEL);

      // then
      expect(result).toEqual({ value: "¿Qué es un grafo?", error: null });
    });
  });
});
