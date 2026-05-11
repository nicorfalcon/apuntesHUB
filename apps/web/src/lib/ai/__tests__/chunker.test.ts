import { describe, it, expect } from "vitest";
import { chunkText } from "../chunker";

describe("chunkText", () => {
  it("retorna array vacío para texto vacío", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("retorna un solo chunk si el texto es menor al chunkSize", () => {
    const result = chunkText("Hola mundo", 700, 120);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Hola mundo");
    expect(result[0].chunkIndex).toBe(0);
  });

  it("divide texto largo en múltiples chunks", () => {
    const word = "palabra ";
    const text = word.repeat(200); // ~1600 chars
    const result = chunkText(text, 700, 120);
    expect(result.length).toBeGreaterThan(1);
  });

  it("los chunks tienen índices consecutivos desde 0", () => {
    const text = "a".repeat(2000);
    const result = chunkText(text, 700, 120);
    result.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it("cada chunk no supera el chunkSize", () => {
    const text = "x".repeat(3000);
    const result = chunkText(text, 700, 120);
    result.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(700);
    });
  });

  it("el overlap hace que el inicio del siguiente chunk coincida con el fin del anterior", () => {
    const chunkSize = 10;
    const overlap = 3;
    const text = "0123456789abcdefghij"; // 20 chars
    const result = chunkText(text, chunkSize, overlap);
    // chunk 0: 0-9, chunk 1 empieza en 7 (10-3=7)
    expect(result[0].content).toBe("0123456789");
    expect(result[1].content.startsWith("789")).toBe(true);
  });

  it("ignora chunks que quedan vacíos después del trim", () => {
    const text = "   "; // solo espacios
    expect(chunkText(text)).toEqual([]);
  });
});
