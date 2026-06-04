import { describe, it, expect, beforeEach, vi } from "vitest";

// Mockeamos el SDK de Cohere (clase con método embed). Validamos:
//   - El input se normaliza (sin diacríticos) antes de mandarlo.
//   - El batching por BATCH_LIMIT=96 funciona correctamente.
//   - Los errores del SDK / respuestas vacías se propagan.

const h = vi.hoisted(() => ({
  embed: vi.fn(),
}));

vi.mock("cohere-ai", () => ({
  CohereClient: class {
    embed = h.embed;
  },
}));

import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  generateEmbeddings,
  generateQueryEmbedding,
} from "../embeddings";

beforeEach(() => {
  h.embed.mockReset();
  vi.stubEnv("COHERE_API_KEY", "key-1");
});

describe("generateEmbeddings", () => {
  it("dado un array de textos, entonces llama Cohere con inputType=search_document", async () => {
    h.embed.mockResolvedValue({ embeddings: [[0.1, 0.2]] });
    await generateEmbeddings(["hola"]);
    expect(h.embed).toHaveBeenCalledWith({
      model: EMBEDDING_MODEL,
      texts: ["hola"],
      inputType: "search_document",
      // truncate: "END" como red de seguridad ante el límite de 512 tokens.
      truncate: "END",
    });
  });

  it("dado un texto con diacríticos, entonces los normaliza antes de embed", async () => {
    h.embed.mockResolvedValue({ embeddings: [[0.1]] });
    await generateEmbeddings(["Le Châtelier"]);
    // El acento ^ del e con circunflejo se descompone y se filtra.
    expect(h.embed).toHaveBeenCalledWith(
      expect.objectContaining({ texts: ["Le Chatelier"] })
    );
  });

  it("dado más de 96 textos, entonces batchea en múltiples llamadas", async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `text-${i}`);
    h.embed.mockResolvedValueOnce({
      embeddings: Array.from({ length: 96 }, () => [0.1]),
    });
    h.embed.mockResolvedValueOnce({
      embeddings: Array.from({ length: 4 }, () => [0.2]),
    });

    const result = await generateEmbeddings(texts);
    expect(h.embed).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(100);
  });

  it("dado que Cohere devuelve embeddings vacíos, entonces lanza error", async () => {
    h.embed.mockResolvedValue({ embeddings: [] });
    await expect(generateEmbeddings(["x"])).rejects.toThrow(
      /no devolvió embeddings/i
    );
  });
});

describe("generateQueryEmbedding", () => {
  it("dado una query, entonces llama Cohere con inputType=search_query y devuelve el primer vector", async () => {
    h.embed.mockResolvedValue({ embeddings: [[1, 2, 3]] });
    const vec = await generateQueryEmbedding("¿qué es Le Châtelier?");
    expect(h.embed).toHaveBeenCalledWith(
      expect.objectContaining({ inputType: "search_query", truncate: "END" })
    );
    expect(vec).toEqual([1, 2, 3]);
  });

  it("expone las constantes EMBEDDING_MODEL y EMBEDDING_DIM", () => {
    expect(EMBEDDING_MODEL).toBe("embed-multilingual-v3.0");
    expect(EMBEDDING_DIM).toBe(1024);
  });
});

describe("getClient (vía generateEmbeddings)", () => {
  it("dado que falta COHERE_API_KEY, entonces lanza error en la primera llamada", async () => {
    vi.stubEnv("COHERE_API_KEY", "");
    await expect(generateEmbeddings(["x"])).rejects.toThrow(
      /COHERE_API_KEY/
    );
  });
});
