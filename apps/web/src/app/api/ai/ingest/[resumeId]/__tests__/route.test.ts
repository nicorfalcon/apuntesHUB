import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mocks centralizados (hoisted) para reprogramar por test.
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  resumeSingle: vi.fn(),
  checkRateLimit: vi.fn(),
  extractPdfPages: vi.fn(),
  chunkPdfPages: vi.fn(),
  generateEmbeddings: vi.fn(),
  download: vi.fn(),
  // RPC transaccional de reemplazo de chunks.
  rpc: vi.fn(),
  // Registro de operaciones sobre la DB para verificar invariantes.
  order: [] as string[],
  // Payloads de upsert (inicio del job) y update (done/failed) sobre ingestion_jobs.
  jobUpserts: [] as Array<Record<string, unknown>>,
  jobUpdates: [] as Array<Record<string, unknown>>,
  // Detecta cualquier delete/insert manual sobre document_chunks (no debe ocurrir).
  manualChunkOps: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single: h.resumeSingle }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ download: h.download }),
    },
    rpc: h.rpc,
    from: (table: string) => ({
      // ingestion_jobs.upsert(...).select().single()
      upsert: (payload: Record<string, unknown>) => {
        if (table === "ingestion_jobs") h.jobUpserts.push(payload);
        return {
          select: () => ({
            single: async () => ({ data: { id: "job-1" }, error: null }),
          }),
        };
      },
      // delete/insert manual: NO debe usarse para document_chunks (lo hace la RPC).
      delete: () => ({
        eq: async () => {
          h.manualChunkOps.push(`delete:${table}`);
          return { error: null };
        },
      }),
      insert: async () => {
        h.manualChunkOps.push(`insert:${table}`);
        return { error: null };
      },
      // ingestion_jobs.update(...).eq()
      update: (payload: Record<string, unknown>) => {
        if (table === "ingestion_jobs") h.jobUpdates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

vi.mock("@/lib/ai/pdf-extractor", () => ({
  extractPdfPages: h.extractPdfPages,
}));

vi.mock("@/lib/ai/pdf-chunker", () => ({
  chunkPdfPages: h.chunkPdfPages,
  CHUNKING_VERSION: "m3-v1",
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbeddings: h.generateEmbeddings,
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  checkRateLimit: h.checkRateLimit,
}));

import { POST } from "../route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ai/ingest/r1", { method: "POST" });
}

function ctx() {
  return { params: Promise.resolve({ resumeId: "r1" }) };
}

const USER = { id: "seller-1" };

const SAMPLE_CHUNKS = [
  {
    content: "Contenido del chunk uno.",
    pageStart: 1,
    pageEnd: 2,
    sectionTitle: "Unidad 1",
    chunkIndex: 0,
    tokenCount: 12,
    charCount: 24,
    metadata: {
      pageStart: 1,
      pageEnd: 2,
      sectionTitle: "Unidad 1",
      source: "pdf",
      chunkingVersion: "m3-v1",
      hasShortText: false,
    },
  },
];

describe("POST /api/ai/ingest/[resumeId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.order = [];
    h.jobUpserts = [];
    h.jobUpdates = [];
    h.manualChunkOps = [];
    h.getUser.mockResolvedValue({ data: { user: USER } });
    h.resumeSingle.mockResolvedValue({
      data: { id: "r1", seller_id: "seller-1", file_url: "path/r1.pdf" },
      error: null,
    });
    h.checkRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 1000 });
    h.download.mockResolvedValue({
      data: { arrayBuffer: async () => new ArrayBuffer(8) },
      error: null,
    });
    h.extractPdfPages.mockResolvedValue({
      pages: [{ pageNumber: 1, text: "hola" }],
      fullText: "contenido suficiente para superar el umbral mínimo de texto",
      pageCount: 2,
    });
    h.chunkPdfPages.mockReturnValue(SAMPLE_CHUNKS);
    h.generateEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
    // Por defecto la RPC devuelve la cantidad esperada de chunks.
    h.rpc.mockResolvedValue({ data: SAMPLE_CHUNKS.length, error: null });
  });

  it("rechaza si el usuario no es el seller del apunte", async () => {
    h.resumeSingle.mockResolvedValue({
      data: { id: "r1", seller_id: "otro", file_url: "x" },
      error: null,
    });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(403);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("usa la RPC transaccional (no delete+insert manual) tras generar embeddings", async () => {
    await POST(makeRequest(), ctx());

    // Embeddings se generan antes de la RPC.
    const embedOrder = h.generateEmbeddings.mock.invocationCallOrder[0];
    const rpcOrder = h.rpc.mock.invocationCallOrder[0];
    expect(embedOrder).toBeLessThan(rpcOrder);

    // Se llamó a la RPC de reemplazo transaccional.
    expect(h.rpc).toHaveBeenCalledWith(
      "reingest_document_chunks",
      expect.objectContaining({ p_resume_id: "r1" })
    );
    // NO se usó delete ni insert manual sobre document_chunks.
    expect(h.manualChunkOps).toEqual([]);
    expect(h.generateEmbeddings).toHaveBeenCalledWith(["Contenido del chunk uno."]);
  });

  it("envía a la RPC los chunks con metadata M3 y resume_id desde el path", async () => {
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);

    const [, args] = h.rpc.mock.calls[0];
    expect(args.p_resume_id).toBe("r1");
    const payload = args.p_chunks as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      content: "Contenido del chunk uno.",
      chunk_index: 0,
      page_start: 1,
      page_end: 2,
      section_title: "Unidad 1",
      token_count: 12,
      char_count: 24,
    });
    // El embedding viaja como texto JSON "[...]" (lo castea la RPC a vector).
    expect(payload[0].embedding).toBe(JSON.stringify([0.1, 0.2, 0.3]));
    expect(payload[0].metadata).toMatchObject({
      source: "pdf",
      chunkingVersion: "m3-v1",
    });
    // El payload NO debe incluir resume_id por chunk (lo fija la RPC).
    expect(payload[0].resume_id).toBeUndefined();

    const body = await res.json();
    expect(body).toMatchObject({ ok: true, chunks: 1, pages: 2 });
  });

  it("no llama a la RPC si la generación de embeddings falla", async () => {
    h.generateEmbeddings.mockRejectedValue(new Error("Cohere down"));
    const res = await POST(makeRequest(), ctx());
    // Error genérico del proveedor -> EMBEDDING_PROVIDER_ERROR (502).
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("EMBEDDING_PROVIDER_ERROR");
    expect(h.rpc).not.toHaveBeenCalled();
    // Nunca se tocaron los chunks manualmente.
    expect(h.manualChunkOps).toEqual([]);
  });

  it("falla si no se generan chunks (CHUNKS_EMPTY, no llama a la RPC)", async () => {
    h.chunkPdfPages.mockReturnValue([]);
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("CHUNKS_EMPTY");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("al iniciar, marca processing y limpia el error de un intento anterior", async () => {
    await POST(makeRequest(), ctx());
    const upsert = h.jobUpserts[0];
    expect(upsert).toMatchObject({
      status: "processing",
      error_message: null,
      error_code: null,
      retryable: null,
    });
  });

  it("caso exitoso: marca done con cantidad de chunks y limpia el error", async () => {
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({
      status: "done",
      chunks_generated: 1,
      error_code: null,
      error_message: null,
      retryable: null,
    });
  });

  it("error 429 de Cohere -> persiste COHERE_RATE_LIMIT y responde retryable", async () => {
    h.generateEmbeddings.mockRejectedValue({ statusCode: 429, message: "Too Many Requests" });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.code).toBe("COHERE_RATE_LIMIT");
    expect(body.retryable).toBe(true);
    // No filtra detalle técnico crudo al usuario.
    expect(body.detail).toBeUndefined();

    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({
      status: "failed",
      error_code: "COHERE_RATE_LIMIT",
      retryable: true,
    });
    // No se tocaron los chunks (falló antes de la RPC).
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("PDF sin texto -> persiste PDF_NO_TEXT y responde 422 (no reintentable)", async () => {
    h.extractPdfPages.mockResolvedValue({
      pages: [{ pageNumber: 1, text: "" }],
      fullText: "   ",
      pageCount: 1,
    });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.code).toBe("PDF_NO_TEXT");
    expect(body.retryable).toBe(false);

    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed", error_code: "PDF_NO_TEXT" });
    expect(h.generateEmbeddings).not.toHaveBeenCalled();
  });

  it("fallo de la RPC -> persiste DB_REINGEST_ERROR y responde retryable", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "insert viol. constraint" } });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe("DB_REINGEST_ERROR");
    expect(body.retryable).toBe(true);

    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed", error_code: "DB_REINGEST_ERROR" });
  });

  it("conteo inconsistente de la RPC -> DB_REINGEST_ERROR", async () => {
    h.rpc.mockResolvedValue({ data: 0, error: null });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed", error_code: "DB_REINGEST_ERROR" });
  });
});
