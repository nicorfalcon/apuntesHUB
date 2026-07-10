import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

type DocumentChunkRow = {
  id: string;
  resume_id: string;
  chunk_index: number;
  content: string;
};

type PurchaseMetadataRow = {
  resume_id: string;
  buyer_id?: string;
  status?: string;
  resumes: {
    title: string | null;
    subject: string | null;
    topics: string[] | null;
  } | null;
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
  purchaseRows: [] as PurchaseMetadataRow[],
  usageEventInsert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpcSearchChunks,
    from: (table: string) => {
      if (table === "ai_usage_events") {
        return {
          insert: h.usageEventInsert,
        };
      }

      if (table === "purchases") {
        const filters: Record<string, unknown> = {};
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return builder;
          },
          in: (column: string, values: unknown[]) => {
            filters[column] = values;
            return builder;
          },
          limit: async () => ({
            data: h.purchaseRows.filter((row) => {
              if (filters.buyer_id && row.buyer_id && row.buyer_id !== filters.buyer_id) {
                return false;
              }
              if (filters.status && row.status && row.status !== filters.status) {
                return false;
              }
              const resumeIds = filters.resume_id as string[] | undefined;
              if (resumeIds && !resumeIds.includes(row.resume_id)) return false;
              return true;
            }),
            error: null,
          }),
        };
        return builder;
      }

      return {
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
      };
    },
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
    h.purchaseRows = [];
    h.usageEventInsert.mockResolvedValue({ error: null });
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

    it("devuelve activity para modo verdadero/falso cuando el LLM responde JSON válido", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: [chunk("r1", 0, "Le Chatelier y temperatura", 0.9)],
        error: null,
      });
      h.answerFromContext.mockResolvedValue(JSON.stringify({
        type: "true_false",
        title: "Le Chatelier",
        questions: [
          {
            id: "q1",
            statement: "El equilibrio puede responder a cambios de temperatura.",
            answer: true,
            explanation: "El contexto menciona temperatura como perturbación.",
            sourceLabel: "pág. 1",
          },
        ],
      }));

      // when
      const res = await POST(makeRequest({
        query: "armame verdadero o falso",
        resumeIds: ["r1"],
        answerMode: "true_false",
      }));

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answer).toBe("Actividad lista para practicar.");
      expect(body.activity).toMatchObject({
        type: "true_false",
        title: "Le Chatelier",
        questions: [expect.objectContaining({ answer: true })],
      });
      expect(body.sources).toEqual([{ type: "note", label: "Tu apunte" }]);
    });

    it("reintenta una vez en plataforma y devuelve activity si el segundo intento valida", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: [chunk("r1", 0, "Kc y Kp", 0.9)],
        error: null,
      });
      h.answerFromContext
        .mockResolvedValueOnce("```json\n{ roto")
        .mockResolvedValueOnce(JSON.stringify({
          type: "multiple_choice",
          title: "Kc y Kp",
          questions: [
            {
              id: "q1",
              question: "¿Qué relaciona Kp con Kc?",
              options: ["RT", "Masa", "Color", "Hora"],
              correctOptionIndex: 0,
              explanation: "El contexto lo menciona.",
            },
          ],
        }));

      // when
      const res = await POST(makeRequest({
        query: "armame multiple choice sobre kc y kp",
        resumeIds: ["r1"],
        answerMode: "multiple_choice",
      }));

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(h.answerFromContext).toHaveBeenCalledTimes(2);
      expect(h.answerFromContext.mock.calls[1][2]).toMatchObject({ repair: true });
      expect(body.activity).toMatchObject({ type: "multiple_choice" });
      expect(body.answer).toBe("Actividad lista para practicar.");
    });

    it("no expone JSON crudo si una actividad de plataforma no valida", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: [chunk("r1", 0, "ctx", 0.9)],
        error: null,
      });
      h.answerFromContext.mockResolvedValue('{"type":"true_false","questions":[');

      // when
      const res = await POST(makeRequest({
        query: "armame verdadero o falso",
        resumeIds: ["r1"],
        answerMode: "true_false",
      }));

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.activity).toBeUndefined();
      expect(body.answer).toContain("No pude armar tarjetas interactivas");
      expect(body.answer).toContain("practicar");
      expect(body.answer).not.toContain('"type"');
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

    it("usa la query reformulada para embedding y RPC, pero conserva la pregunta original en el prompt", async () => {
      // given
      const latestQuery = "me podés explicar más sobre eso";
      h.rpcSearchChunks.mockResolvedValue({
        data: [
          chunk("r1", 0, "Le Chatelier ajusta el equilibrio", 0.91),
          chunk("r1", 1, "concentración y presión", 0.89),
          chunk("r1", 2, "temperatura", 0.87),
          chunk("r1", 3, "ejemplo", 0.85),
        ],
        error: null,
      });
      h.answerFromContext.mockResolvedValue("respuesta enfocada");

      // when
      const res = await POST(makeRequest({
        query: latestQuery,
        resumeIds: ["r1"],
        messages: [
          { role: "user", content: "qué es Le Chatelier" },
          { role: "assistant", content: "El principio de Le Chatelier describe..." },
        ],
        resumeTitle: "Equilibrio Químico",
        subject: "Química",
      }));

      // then
      expect(res.status).toBe(200);
      const retrievalQuery = h.generateQueryEmbedding.mock.calls[0][0] as string;
      expect(retrievalQuery).toContain("Le Chatelier");
      expect(retrievalQuery).toContain("Equilibrio Químico");
      expect(retrievalQuery).not.toBe(latestQuery);
      expect(h.rpcSearchChunks).toHaveBeenCalledWith(
        "search_chunks_hybrid_for_study",
        expect.objectContaining({ query_text: retrievalQuery })
      );
      expect(h.answerFromContext).toHaveBeenCalledWith(
        latestQuery,
        expect.any(Array),
        expect.objectContaining({
          recentMessages: expect.arrayContaining([
            { role: "user", content: "qué es Le Chatelier" },
          ]),
        })
      );
    });

    it("pasa topics del apunte al LLM como metadata de orientación", async () => {
      // given
      h.purchaseRows = [
        {
          resume_id: "r1",
          buyer_id: VALID_USER.id,
          status: "completed",
          resumes: {
            title: "Equilibrio Químico DB",
            subject: "Química DB",
            topics: ["Le Chatelier", "temperatura"],
          },
        },
      ];
      h.rpcSearchChunks.mockResolvedValue({
        data: [
          chunk("r1", 0, "El equilibrio se desplaza ante cambios de temperatura.", 0.91),
        ],
        error: null,
      });
      h.answerFromContext.mockResolvedValue("respuesta sobre Chatelier");

      // when
      const res = await POST(makeRequest({
        query: "Qué es Chatelier?",
        resumeIds: ["r1"],
        resumeTitle: "Equilibrio Químico",
        subject: "Química",
        topics: ["Tema falso del cliente"],
        answerMode: "quiz",
      }));

      // then
      expect(res.status).toBe(200);
      expect(h.answerFromContext).toHaveBeenCalledWith(
        "Qué es Chatelier?",
        expect.any(Array),
        expect.objectContaining({
          studyMetadata: {
            resumeTitle: "Equilibrio Químico DB",
            subject: "Química DB",
            topics: ["Le Chatelier", "temperatura"],
          },
          answerMode: "quiz",
        })
      );
    });

    it("no usa topics enviados por cliente si no están autorizados en DB", async () => {
      // given
      h.purchaseRows = [];
      h.rpcSearchChunks.mockResolvedValue({
        data: [chunk("r1", 0, "ctx", 0.9)],
        error: null,
      });
      h.answerFromContext.mockResolvedValue("respuesta");

      // when
      const res = await POST(makeRequest({
        query: "Qué es Chatelier?",
        resumeIds: ["r1"],
        topics: ["Topic falso"],
      }));

      // then
      expect(res.status).toBe(200);
      expect(h.answerFromContext).toHaveBeenCalledWith(
        "Qué es Chatelier?",
        expect.any(Array),
        expect.objectContaining({
          studyMetadata: { resumeTitle: null, subject: null, topics: [] },
        })
      );
    });

    it("no rompe con historial vacío", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: [chunk("r1", 0, "ctx", 0.9)],
        error: null,
      });
      h.answerFromContext.mockResolvedValue("ok");

      // when
      const res = await POST(makeRequest({ ...VALID_QUERY, messages: [] }));

      // then
      expect(res.status).toBe(200);
      expect(h.generateQueryEmbedding).toHaveBeenCalledWith(VALID_QUERY.query);
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

    it("ordena grupos de contexto por relevancia de seed y mantiene vecinos cerca", async () => {
      // given
      h.rpcSearchChunks.mockResolvedValue({
        data: [
          chunk("r1", 10, "seed más relevante", 0.95),
          chunk("r2", 5, "seed menos relevante", 0.86),
          chunk("r3", 1, "otro seed", 0.8),
          chunk("r4", 1, "otro seed más", 0.79),
        ],
        error: null,
      });
      h.documentChunks = [
        chunk("r1", 9, "vecino del seed relevante"),
        chunk("r2", 4, "vecino del seed menos relevante"),
      ];
      h.answerFromContext.mockResolvedValue("respuesta ordenada");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      const context = h.answerFromContext.mock.calls[0][1] as Array<{
        resumeId: string;
        chunkIndex: number;
      }>;
      expect(context.slice(0, 4)).toEqual([
        expect.objectContaining({ resumeId: "r1", chunkIndex: 9 }),
        expect.objectContaining({ resumeId: "r1", chunkIndex: 10 }),
        expect.objectContaining({ resumeId: "r2", chunkIndex: 4 }),
        expect.objectContaining({ resumeId: "r2", chunkIndex: 5 }),
      ]);
    });

    it("no loguea contenido completo del usuario al reformular follow-ups", async () => {
      // given
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      h.rpcSearchChunks.mockResolvedValue({
        data: [chunk("r1", 0, "ctx", 0.9)],
        error: null,
      });
      h.answerFromContext.mockResolvedValue("ok");

      // when
      const res = await POST(makeRequest({
        query: "me podés explicar más sobre eso",
        messages: [{ role: "user", content: "qué es Le Chatelier con dato sensible" }],
      }));

      // then
      expect(res.status).toBe(200);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("dato sensible"),
        expect.anything()
      );
      logSpy.mockRestore();
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

  describe("metadata de página (M3)", () => {
    beforeEach(() => {
      h.generateQueryEmbedding.mockResolvedValue([0.1, 0.2]);
    });

    it("pasa páginas y sección al contexto cuando la metadata existe", async () => {
      // given: la semilla viene de la RPC sin metadata; document_chunks la aporta.
      h.rpcSearchChunks.mockResolvedValue({
        data: [{ resume_id: "r1", chunk_index: 0, similarity: 0.9, content: "fragmento" }],
        error: null,
      });
      h.documentChunks = [
        {
          id: "r1-0",
          resume_id: "r1",
          chunk_index: 0,
          content: "fragmento",
          page_start: 4,
          page_end: 5,
          section_title: "Normalización",
        } as never,
      ];
      h.answerFromContext.mockResolvedValue("respuesta con páginas");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      const context = h.answerFromContext.mock.calls[0][1] as Array<{
        chunkIndex: number;
        pageStart: number | null;
        pageEnd: number | null;
        sectionTitle: string | null;
      }>;
      const seed = context.find((c) => c.chunkIndex === 0)!;
      expect(seed.pageStart).toBe(4);
      expect(seed.pageEnd).toBe(5);
      expect(seed.sectionTitle).toBe("Normalización");

      // La fuente del apunte expone las páginas para el chip de la UI.
      const body = await res.json();
      expect(body.sources).toEqual([
        { type: "note", label: "Tu apunte", pages: "4-5" },
      ]);
    });

    it("no rompe con chunks viejos sin metadata de página", async () => {
      // given: document_chunks sin columnas de página (chunks pre-M3).
      h.rpcSearchChunks.mockResolvedValue({
        data: [{ resume_id: "r1", chunk_index: 0, similarity: 0.9, content: "viejo" }],
        error: null,
      });
      h.documentChunks = [];
      h.answerFromContext.mockResolvedValue("respuesta sin páginas");

      // when
      const res = await POST(makeRequest(VALID_QUERY));

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answer).toBe("respuesta sin páginas");
      const context = h.answerFromContext.mock.calls[0][1] as Array<{
        pageStart: number | null;
      }>;
      // pageStart null/undefined: el prompt simplemente no incluye página.
      expect(context[0].pageStart ?? null).toBeNull();
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

    it("devuelve activity para multiple choice con modelo propio", async () => {
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
        text: JSON.stringify({
          type: "multiple_choice",
          title: "Equilibrio químico",
          questions: [
            {
              id: "q1",
              question: "¿Qué perturbación aparece en el contexto?",
              options: ["Temperatura", "Mitosis", "Sintaxis", "Geometría"],
              correctOptionIndex: 0,
              explanation: "El fragmento menciona temperatura.",
            },
          ],
        }),
      });

      // when
      const res = await POST(
        makeRequest({
          query: "multiple choice",
          apiKeyId: "k1",
          resumeIds: ["r1"],
          answerMode: "multiple_choice",
        })
      );

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answer).toBe("Actividad lista para practicar.");
      expect(body.activity).toMatchObject({
        type: "multiple_choice",
        questions: [expect.objectContaining({ correctOptionIndex: 0 })],
      });
      expect(body.sources).toEqual([{ type: "note", label: "Tu apunte" }]);
    });

    it("modo estructurado: primer intento inválido y segundo válido devuelve activity", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "gemini",
          model_id: "gemini-2.5-flash",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockReturnValue("sk-plain");
      h.searchWeb.mockResolvedValue([]);
      h.callUserModel
        .mockResolvedValueOnce({ text: "```json\n{ roto sin cerrar" })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            type: "multiple_choice",
            title: "Kc y Kp",
            questions: [
              {
                id: "q1",
                question: "¿Qué relaciona Kp con Kc?",
                options: ["RT", "La masa", "El color", "La hora"],
                correctOptionIndex: 0,
                explanation: "Kp = Kc(RT)^Δn según el apunte.",
              },
            ],
          }),
        });

      // when
      const res = await POST(
        makeRequest({
          query: "armame multiple choice sobre kc y kp",
          apiKeyId: "k1",
          resumeIds: ["r1"],
          answerMode: "multiple_choice",
        })
      );

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(h.callUserModel).toHaveBeenCalledTimes(2);
      expect(body.answer).toBe("Actividad lista para practicar.");
      expect(body.activity).toMatchObject({ type: "multiple_choice" });
      // En modo estructurado NO se usa búsqueda web aunque el modelo la soporte.
      expect(h.searchWeb).not.toHaveBeenCalled();
    });

    it("modo estructurado: ambos intentos inválidos cae a fallback textual sin JSON crudo", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "gemini",
          model_id: "gemini-2.5-flash",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockReturnValue("sk-plain");
      h.callUserModel.mockResolvedValue({
        text: '```json\n{ "type": "multiple_choice", "questions": [',
      });

      // when
      const res = await POST(
        makeRequest({
          query: "armame multiple choice sobre kc y kp",
          apiKeyId: "k1",
          resumeIds: ["r1"],
          answerMode: "multiple_choice",
        })
      );

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(h.callUserModel).toHaveBeenCalledTimes(2);
      expect(body.activity).toBeUndefined();
      expect(body.answer).toContain("No pude armar tarjetas interactivas");
      expect(body.answer).not.toContain('"type"');
    });

    it("true_false con modelo propio repara en el segundo intento", async () => {
      // given
      h.adminUserKeySingle.mockResolvedValue({
        data: {
          id: "k1",
          provider: "gemini",
          model_id: "gemini-2.5-flash",
          key_encrypted: "x",
          key_iv: "y",
        },
      });
      h.decryptApiKey.mockReturnValue("sk-plain");
      h.callUserModel
        .mockResolvedValueOnce({ text: "no es json" })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            type: "true_false",
            title: "Le Chatelier",
            questions: [
              {
                id: "q1",
                statement: "El equilibrio responde a la temperatura.",
                answer: true,
                explanation: "El apunte lo menciona.",
              },
            ],
          }),
        });

      // when
      const res = await POST(
        makeRequest({
          query: "armame verdadero o falso sobre Le Chatelier",
          apiKeyId: "k1",
          resumeIds: ["r1"],
          answerMode: "true_false",
        })
      );

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.activity).toMatchObject({ type: "true_false" });
    });

    it("modo normal usa web y no reintenta ni parsea actividad", async () => {
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
      h.searchWeb.mockResolvedValue([
        { source: "Wikipedia", snippet: "algo", url: "https://a.com" },
      ]);
      h.callUserModel.mockResolvedValue({
        text: 'Respuesta normal.\nFUENTES_JSON:[{"type":"note","label":"Tu apunte"}]',
      });

      // when
      const res = await POST(
        makeRequest({
          query: "explicame kc y kp",
          apiKeyId: "k1",
          resumeIds: ["r1"],
          answerMode: "explain",
        })
      );

      // then
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(h.searchWeb).toHaveBeenCalledTimes(1);
      expect(h.callUserModel).toHaveBeenCalledTimes(1);
      expect(body.answer).toBe("Respuesta normal.");
      expect(body.activity).toBeUndefined();
    });

    it("incluye topics e historial en el prompt del modelo propio", async () => {
      // given
      h.purchaseRows = [
        {
          resume_id: "r1",
          buyer_id: VALID_USER.id,
          status: "completed",
          resumes: {
            title: "Equilibrio Químico",
            subject: "Química",
            topics: ["Le Chatelier"],
          },
        },
      ];
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
          'Respuesta.\nFUENTES_JSON:[{"type":"note","label":"Tu apunte"}]',
      });

      // when
      const res = await POST(
        makeRequest({
          query: "dame un ejemplo de eso",
          apiKeyId: "k1",
          resumeIds: ["r1"],
          answerMode: "example",
          messages: [{ role: "user", content: "Qué es Chatelier?" }],
          topics: ["Topic falso"],
        })
      );

      // then
      expect(res.status).toBe(200);
      const prompt = h.callUserModel.mock.calls[0][0].prompt as string;
      expect(prompt).toContain("Temas declarados del apunte: Le Chatelier");
      expect(prompt).toContain("HISTORIAL RECIENTE:");
      expect(prompt).toContain("Usuario: Qué es Chatelier?");
      expect(prompt).toContain("Modo de respuesta: Dar ejemplo");
      expect(prompt).toContain("Ejemplo ilustrativo:");
    });
  });
});
