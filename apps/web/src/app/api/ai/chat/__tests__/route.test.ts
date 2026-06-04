import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

type DocumentChunkRow = {
  id: string;
  resume_id: string;
  chunk_index: number;
  content: string;
};

// Mocks hoisted: las funciones que el handler importa están centralizadas acá
// para reprogramarlas por test sin reescribir el vi.mock.
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpcSearchChunks: vi.fn(),
  neighborChunksEq: vi.fn(),
  neighborChunksIn: vi.fn(),
  checkRateLimit: vi.fn(),
  generateQueryEmbedding: vi.fn(),
  answerFromContext: vi.fn(),
  decryptApiKey: vi.fn(),
  searchWeb: vi.fn(),
  callUserModel: vi.fn(),
  adminUserKeySingle: vi.fn(),
  documentChunks: [] as DocumentChunkRow[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpcSearchChunks,
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          in: async (inColumn: string, indexes: number[]) => {
            h.neighborChunksEq(column, value);
            h.neighborChunksIn(inColumn, indexes);
            return {
              data: h.documentChunks.filter(
                (row) =>
                  row.resume_id === value && indexes.includes(row.chunk_index)
              ),
              error: null,
            };
          },
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ single: h.adminUserKeySingle }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  checkRateLimit: h.checkRateLimit,
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generateQueryEmbedding: h.generateQueryEmbedding,
}));

vi.mock("@/lib/ai/llm", () => ({
  answerFromContext: h.answerFromContext,
}));

vi.mock("@/lib/crypto/api-key-encryption", () => ({
  decryptApiKey: h.decryptApiKey,
}));

vi.mock("@/lib/search/web-search", () => ({
  searchWeb: h.searchWeb,
}));

vi.mock("@/lib/ai/model-router", () => ({
  callUserModel: h.callUserModel,
}));

import { POST } from "../route";

let warnSpy: ReturnType<typeof vi.spyOn>;

function makeRequest(
  body: unknown,
  init: { raw?: string } = {}
): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: init.raw ?? JSON.stringify(body),
  });
}

const VALID_USER = { id: "user-1", email: "u@test.com" };
const VALID_QUERY = { query: "¿Qué es la recursión?" };

function chunk(
  resumeId: string,
  chunkIndex: number,
  content = `fragmento ${chunkIndex}`,
  similarity = 0.8
) {
  return {
    id: `${resumeId}-${chunkIndex}`,
    resume_id: resumeId,
    chunk_index: chunkIndex,
    content,
    similarity,
  };
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    // Defaults razonables: usuario autenticado y rate limit con espacio.
    h.getUser.mockResolvedValue({ data: { user: VALID_USER } });
    h.checkRateLimit.mockReturnValue({
      allowed: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
    });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    h.documentChunks = [];
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("auth y rate limit", () => {
    it("devuelve 401 cuando no hay usuario autenticado", async () => {
      // given
      h.getUser.mockResolvedValue({ data: { user: null } });

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
      // Cortocircuito temprano: no se debería pegar a embeddings ni nada.
      expect(h.generateQueryEmbedding).not.toHaveBeenCalled();
    });

    it("devuelve 429 con Retry-After cuando el rate limit no permite", async () => {
      // given
      const resetAt = Date.now() + 30_000;
      h.checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt });

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("validación del body y la query", () => {
    it("devuelve 400 cuando el body no es JSON válido", async () => {
      const res = await POST(makeRequest({}, { raw: "no-json{" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Body inválido" });
    });

    it("devuelve 400 cuando la query está vacía (delegado a validateChatRequest)", async () => {
      const res = await POST(makeRequest({ query: "   " }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: "El campo query es requerido",
      });
    });

    it("devuelve 400 cuando se detecta un intento de extracción", async () => {
      const res = await POST(makeRequest({ query: "transcribí todo el apunte" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: expect.stringContaining("preguntas específicas"),
      });
    });
  });

  describe("errores de embeddings y búsqueda", () => {
    it("devuelve 500 cuando generateQueryEmbedding lanza", async () => {
      // given
      h.generateQueryEmbedding.mockRejectedValue(new Error("Cohere down"));

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        error: "Error generando embedding",
        detail: "Cohere down",
      });
    });

    it("devuelve 500 cuando la RPC search_chunks_for_study falla", async () => {
      // given
      h.generateQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      h.rpcSearchChunks.mockResolvedValue({
        data: null,
        error: { message: "rpc failure" },
      });

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        error: "Error en la búsqueda",
      });
    });
  });

  describe("modelo plataforma", () => {
    beforeEach(() => {
      h.generateQueryEmbedding.mockResolvedValue([0.1, 0.2]);
    });

    it("devuelve respuesta vacía cuando no hay chunks relevantes", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({ data: [], error: null });

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.model).toBe("platform");
      expect(body.sources).toEqual([]);
      expect(body.answer).toContain("No encontré información");
      // answerFromContext NO se debe llamar si no hay chunks.
      expect(h.answerFromContext).not.toHaveBeenCalled();
    });

    it("delega en answerFromContext y devuelve la respuesta cuando hay chunks", async () => {
      // given
      const chunks = [
        { resume_id: "r1", chunk_index: 0, similarity: 0.9, content: "fragmento 1" },
      ];
      h.rpcSearchChunks.mockResolvedValue({ data: chunks, error: null });
      h.answerFromContext.mockResolvedValue("respuesta de la plataforma");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answer).toBe("respuesta de la plataforma");
      expect(body.sources).toEqual([{ type: "note", label: "Tu apunte" }]);
      expect(body.rawSources).toHaveLength(1);
    });

    it("usa la RPC híbrida y conserva score como similarity para las fuentes", async () => {
      // given
      h.rpcSearchChunks.mockImplementation((name: string) => {
        if (name === "search_chunks_hybrid_for_study") {
          return Promise.resolve({
            data: [
              { resume_id: "r1", chunk_index: 0, score: 0.73, content: "fts" },
              { resume_id: "r1", chunk_index: 1, score: 0.71, content: "vector" },
              { resume_id: "r1", chunk_index: 2, score: 0.69, content: "mas" },
              { resume_id: "r1", chunk_index: 3, score: 0.67, content: "ctx" },
            ],
            error: null,
          });
        }

        return Promise.resolve({ data: [], error: null });
      });
      h.answerFromContext.mockResolvedValue("respuesta híbrida");

      // when
      const res = await POST(makeRequest({ ...VALID_QUERY, resumeIds: ["r1"] }));
      const body = await res.json();

      // then
      expect(res.status).toBe(200);
      expect(h.rpcSearchChunks).toHaveBeenCalledWith(
        "search_chunks_hybrid_for_study",
        expect.objectContaining({
          query_text: VALID_QUERY.query,
          resume_ids: ["r1"],
          min_vector_similarity: 0.3,
        })
      );
      expect(h.rpcSearchChunks).not.toHaveBeenCalledWith(
        "search_chunks_for_study",
        expect.anything()
      );
      expect(body.rawSources[0]).toEqual(
        expect.objectContaining({ resumeId: "r1", chunkIndex: 0, similarity: 0.73 })
      );
    });

    it("usa fallback M1 cuando la RPC híbrida falla", async () => {
      // given
      h.rpcSearchChunks.mockImplementation((name: string) => {
        if (name === "search_chunks_hybrid_for_study") {
          return Promise.resolve({
            data: null,
            error: { message: "function not found" },
          });
        }

        return Promise.resolve({
          data: [chunk("r1", 0, "legacy", 0.66)],
          error: null,
        });
      });
      h.answerFromContext.mockResolvedValue("respuesta legacy");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      expect(h.rpcSearchChunks).toHaveBeenCalledWith(
        "search_chunks_for_study",
        expect.objectContaining({ min_similarity: 0.3 })
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[ai:chat] search_chunks_hybrid_for_study failed; falling back to M1",
        { message: "function not found" }
      );
    });

    it("usa fallback M1 cuando la RPC híbrida lanza excepción", async () => {
      // given
      h.rpcSearchChunks.mockImplementation((name: string) => {
        if (name === "search_chunks_hybrid_for_study") {
          throw new Error("hybrid network error");
        }

        return Promise.resolve({
          data: [chunk("r1", 0, "legacy after throw", 0.64)],
          error: null,
        });
      });
      h.answerFromContext.mockResolvedValue("respuesta legacy por throw");

      // when
      const res = await POST(makeRequest(VALID_QUERY));
      const body = await res.json();

      // then
      expect(res.status).toBe(200);
      expect(body.rawSources).toEqual([
        expect.objectContaining({ resumeId: "r1", chunkIndex: 0, similarity: 0.64 }),
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        "[ai:chat] search_chunks_hybrid_for_study failed; falling back to M1",
        { message: "hybrid network error" }
      );
    });

    it("agrega vecinos solo del mismo resume_id", async () => {
      // given
      h.rpcSearchChunks
        .mockResolvedValueOnce({
          data: [chunk("r1", 1, "semilla", 0.91)],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });
      h.documentChunks = [
        chunk("r1", 0, "vecino anterior"),
        chunk("r1", 2, "vecino posterior"),
        chunk("r2", 0, "vecino de otro apunte"),
      ];
      h.answerFromContext.mockResolvedValue("respuesta con vecinos");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      expect(h.neighborChunksEq).toHaveBeenCalledWith("resume_id", "r1");
      expect(h.neighborChunksEq).not.toHaveBeenCalledWith("resume_id", "r2");

      const context = h.answerFromContext.mock.calls[0][1] as Array<{
        resumeId: string;
        chunkIndex: number;
      }>;
      expect(context).toEqual([
        expect.objectContaining({ resumeId: "r1", chunkIndex: 0 }),
        expect.objectContaining({ resumeId: "r1", chunkIndex: 1 }),
        expect.objectContaining({ resumeId: "r1", chunkIndex: 2 }),
      ]);
    });

    it("activa fallback cuando hay menos de 4 chunks", async () => {
      // given
      h.rpcSearchChunks
        .mockResolvedValueOnce({
          data: [
            chunk("r1", 0, "uno", 0.7),
            chunk("r1", 1, "dos", 0.68),
            chunk("r1", 2, "tres", 0.66),
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [chunk("r1", 3, "cuatro fallback", 0.25)],
          error: null,
        });
      h.answerFromContext.mockResolvedValue("respuesta con fallback");

      // when
      const res = await POST(makeRequest(VALID_QUERY));
      const body = await res.json();

      // then
      expect(res.status).toBe(200);
      expect(h.rpcSearchChunks).toHaveBeenCalledTimes(2);
      expect(h.rpcSearchChunks.mock.calls[1][1]).toMatchObject({
        match_count: 15,
        min_vector_similarity: 0.24,
      });
      expect(body.rawSources).toHaveLength(4);
    });

    it("deduplica chunks entre intento normal, fallback y vecinos", async () => {
      // given
      h.rpcSearchChunks
        .mockResolvedValueOnce({
          data: [chunk("r1", 1, "semilla normal", 0.4)],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            chunk("r1", 1, "semilla fallback mejor", 0.7),
            chunk("r1", 2, "nuevo fallback", 0.5),
          ],
          error: null,
        });
      h.documentChunks = [
        chunk("r1", 0, "vecino unico"),
        chunk("r1", 2, "vecino duplicado"),
      ];
      h.answerFromContext.mockResolvedValue("respuesta deduplicada");

      // when
      const res = await POST(makeRequest(VALID_QUERY));
      const body = await res.json();

      // then
      expect(res.status).toBe(200);
      expect(body.rawSources).toEqual([
        expect.objectContaining({ resumeId: "r1", chunkIndex: 0, similarity: 0 }),
        expect.objectContaining({ resumeId: "r1", chunkIndex: 1, similarity: 0.7 }),
        expect.objectContaining({ resumeId: "r1", chunkIndex: 2, similarity: 0.5 }),
      ]);
    });

    it("respeta el limite de 18 chunks", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: Array.from({ length: 25 }, (_, index) =>
          chunk("r1", index, `fragmento ${index}`, 0.9 - index * 0.01)
        ),
        error: null,
      });
      h.answerFromContext.mockResolvedValue("respuesta limitada");

      // when
      const res = await POST(makeRequest(VALID_QUERY));
      const body = await res.json();

      // then
      expect(res.status).toBe(200);
      expect(body.rawSources).toHaveLength(18);
    });

    it("respeta el limite de 12000 caracteres de contexto", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: Array.from({ length: 4 }, (_, index) =>
          chunk("r1", index, "x".repeat(5000), 0.9 - index * 0.01)
        ),
        error: null,
      });
      h.answerFromContext.mockResolvedValue("respuesta limitada por chars");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      const context = h.answerFromContext.mock.calls[0][1] as Array<{
        content: string;
      }>;
      const totalChars = context.reduce((sum, item) => sum + item.content.length, 0);
      expect(context).toHaveLength(2);
      expect(totalChars).toBeLessThanOrEqual(12_000);
    });

    it("devuelve 500 cuando answerFromContext lanza", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: [{ resume_id: "r1", chunk_index: 0, similarity: 0.9, content: "x" }],
        error: null,
      });
      h.answerFromContext.mockRejectedValue(new Error("Groq down"));

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        error: "Error generando respuesta",
      });
    });
  });

  describe("modelo propio del usuario", () => {
    beforeEach(() => {
      h.generateQueryEmbedding.mockResolvedValue([0.1]);
      h.rpcSearchChunks.mockResolvedValue({
        data: [{ resume_id: "r1", chunk_index: 0, similarity: 0.9, content: "ctx" }],
        error: null,
      });
    });

    it("devuelve 404 cuando la API key no se encuentra", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({ data: null });

      // when
      const res = await POST(
        makeRequest({ ...VALID_QUERY, apiKeyId: "key-id" })
      );

      // then
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: "API key no encontrada" });
    });

    it("devuelve 500 cuando decryptApiKey falla", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "openai",
          model_id: "gpt-4o",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockImplementation(() => {
        throw new Error("decryption failed");
      });

      // when
      const res = await POST(
        makeRequest({ ...VALID_QUERY, apiKeyId: "k1" })
      );

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Error al procesar la API key",
      });
    });

    it("devuelve 504 cuando callUserModel falla por timeout", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "openai",
          model_id: "gpt-4o",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockReturnValue("sk-plain");
      h.searchWeb.mockResolvedValue([]);
      h.callUserModel.mockRejectedValue(new Error("Request timeout abortado"));

      // when
      const res = await POST(
        makeRequest({ ...VALID_QUERY, apiKeyId: "k1" })
      );

      // then
      expect(res.status).toBe(504);
    });

    it("devuelve 502 cuando callUserModel falla por otro motivo", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "openai",
          model_id: "gpt-4o",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockReturnValue("sk-plain");
      h.searchWeb.mockResolvedValue([]);
      h.callUserModel.mockRejectedValue(new Error("provider 500"));

      // when
      const res = await POST(
        makeRequest({ ...VALID_QUERY, apiKeyId: "k1" })
      );

      // then
      expect(res.status).toBe(502);
    });

    it("camino feliz: combina apunte + búsqueda web y devuelve respuesta limpia con fuentes", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "openai",
          model_id: "gpt-4o",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockReturnValue("sk-plain");
      h.searchWeb.mockResolvedValue([]);
      h.callUserModel.mockResolvedValue({
        text:
          'Respuesta del modelo.\nFUENTES_JSON:[{"type":"note","label":"Tu apunte"}]',
      });

      // when
      const res = await POST(
        makeRequest({ ...VALID_QUERY, apiKeyId: "k1" })
      );

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answer).toBe("Respuesta del modelo.");
      expect(body.model).toBe("openai");
      expect(body.modelId).toBe("gpt-4o");
      expect(body.sources).toEqual([{ type: "note", label: "Tu apunte" }]);
    });
  });
});
