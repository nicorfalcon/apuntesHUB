import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mockeamos el SDK de Cohere (clase con método embed). Validamos:
//   - El input se normaliza (sin diacríticos) antes de mandarlo.
//   - El batching por BATCH_LIMIT=96 funciona correctamente.
//   - Los errores del SDK / respuestas vacías se propagan.
//   - Retry/backoff ante errores retryable y orden/concurrencia preservados.

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

  it("dado que Cohere devuelve embeddings vacíos, entonces lanza error (sin reintentar)", async () => {
    h.embed.mockResolvedValue({ embeddings: [] });
    await expect(generateEmbeddings(["x"])).rejects.toThrow(
      /no devolvió embeddings/i
    );
    // Respuesta vacía = contrato roto, no transitorio: una sola llamada.
    expect(h.embed).toHaveBeenCalledTimes(1);
  });

  it("no manda textos vacíos a Cohere y rellena esas posiciones con vector cero", async () => {
    h.embed.mockResolvedValue({ embeddings: [[0.7]] });
    const res = await generateEmbeddings(["", "  ", "hola"]);
    expect(h.embed).toHaveBeenCalledTimes(1);
    expect(h.embed).toHaveBeenCalledWith(
      expect.objectContaining({ texts: ["hola"] })
    );
    expect(res).toHaveLength(3);
    expect(res[2]).toEqual([0.7]);
    expect(res[0]).toHaveLength(EMBEDDING_DIM);
    expect(res[0].every((v) => v === 0)).toBe(true);
    expect(res[1].every((v) => v === 0)).toBe(true);
  });
});

describe("generateEmbeddings - retry/backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reintenta ante 429 y luego tiene éxito", async () => {
    h.embed
      .mockRejectedValueOnce({ statusCode: 429, message: "Too Many Requests" })
      .mockResolvedValueOnce({ embeddings: [[0.5]] });

    const p = generateEmbeddings(["hola"]);
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res).toEqual([[0.5]]);
    expect(h.embed).toHaveBeenCalledTimes(2);
  });

  it("agota los 3 retries y termina fallando si Cohere sigue devolviendo 429", async () => {
    h.embed.mockRejectedValue({ statusCode: 429, message: "Too Many Requests" });

    const p = generateEmbeddings(["hola"]);
    const expectation = expect(p).rejects.toMatchObject({ statusCode: 429 });
    await vi.runAllTimersAsync();
    await expectation;

    // 1 intento inicial + 3 retries = 4 llamadas.
    expect(h.embed).toHaveBeenCalledTimes(4);
  });

  it("no reintenta ante auth error 401", async () => {
    h.embed.mockRejectedValue({ statusCode: 401, message: "Unauthorized" });

    const p = generateEmbeddings(["hola"]);
    const expectation = expect(p).rejects.toMatchObject({ statusCode: 401 });
    await vi.runAllTimersAsync();
    await expectation;

    expect(h.embed).toHaveBeenCalledTimes(1);
  });

  it("no reintenta ante 403", async () => {
    h.embed.mockRejectedValue({ status: 403, message: "Forbidden" });

    const p = generateEmbeddings(["hola"]);
    const expectation = expect(p).rejects.toMatchObject({ status: 403 });
    await vi.runAllTimersAsync();
    await expectation;

    expect(h.embed).toHaveBeenCalledTimes(1);
  });

  it("no reintenta ante quota/billing (no retryable)", async () => {
    h.embed.mockRejectedValue(
      new Error("You have exceeded your monthly quota")
    );

    const p = generateEmbeddings(["hola"]);
    const expectation = expect(p).rejects.toThrow(/quota/i);
    await vi.runAllTimersAsync();
    await expectation;

    expect(h.embed).toHaveBeenCalledTimes(1);
  });

  it("respeta Retry-After del proveedor si es mayor que el backoff", async () => {
    h.embed
      .mockRejectedValueOnce({
        statusCode: 429,
        message: "Too Many Requests",
        headers: { "retry-after": "2" },
      })
      .mockResolvedValueOnce({ embeddings: [[0.9]] });

    const p = generateEmbeddings(["hola"]);
    // Antes de los 2s (Retry-After) no debe haber reintentado todavía.
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.embed).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500);
    const res = await p;

    expect(res).toEqual([[0.9]]);
    expect(h.embed).toHaveBeenCalledTimes(2);
  });
});

describe("generateEmbeddings - orden y concurrencia", () => {
  it("mantiene el orden aunque el lote 2 responda antes que el lote 1", async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `text-${i}`);
    // El primer lote (96 textos) tarda más que el segundo (4 textos): aun así el
    // reensamblaje por índice debe dejar cada embedding en su posición original.
    h.embed.mockImplementation(async ({ texts: batch }: { texts: string[] }) => {
      const firstBatch = batch.length === 96;
      await new Promise((r) => setTimeout(r, firstBatch ? 30 : 5));
      return { embeddings: batch.map((t) => [Number(t.split("-")[1])]) };
    });

    const res = await generateEmbeddings(texts);
    expect(res).toHaveLength(100);
    expect(res[0]).toEqual([0]);
    expect(res[95]).toEqual([95]);
    expect(res[96]).toEqual([96]);
    expect(res[99]).toEqual([99]);
  });

  it("usa la concurrencia default (3) si COHERE_EMBED_CONCURRENCY no está seteado", async () => {
    vi.stubEnv("COHERE_EMBED_CONCURRENCY", "");
    const texts = Array.from({ length: 96 * 5 }, (_, i) => `t-${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    h.embed.mockImplementation(async ({ texts: batch }: { texts: string[] }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { embeddings: batch.map(() => [0.1]) };
    });

    await generateEmbeddings(texts);
    expect(h.embed).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(3);
  });

  it("respeta COHERE_EMBED_CONCURRENCY cuando está seteado", async () => {
    vi.stubEnv("COHERE_EMBED_CONCURRENCY", "2");
    const texts = Array.from({ length: 96 * 5 }, (_, i) => `t-${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    h.embed.mockImplementation(async ({ texts: batch }: { texts: string[] }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { embeddings: batch.map(() => [0.1]) };
    });

    await generateEmbeddings(texts);
    expect(h.embed).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(2);
  });

  it("env inválido cae al default (3)", async () => {
    vi.stubEnv("COHERE_EMBED_CONCURRENCY", "abc");
    const texts = Array.from({ length: 96 * 4 }, (_, i) => `t-${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    h.embed.mockImplementation(async ({ texts: batch }: { texts: string[] }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { embeddings: batch.map(() => [0.1]) };
    });

    await generateEmbeddings(texts);
    expect(maxInFlight).toBe(3);
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
    await expect(generateEmbeddings(["x"])).rejects.toThrow(/COHERE_API_KEY/);
  });
});
