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
  // Último estado con el que se actualizó el job (done/failed).
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
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "job-1" }, error: null }),
        }),
      }),
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
    expect(res.status).toBe(500);
    expect(h.rpc).not.toHaveBeenCalled();
    // Nunca se tocaron los chunks manualmente.
    expect(h.manualChunkOps).toEqual([]);
  });

  it("falla si no se generan chunks (no llama a la RPC)", async () => {
    h.chunkPdfPages.mockReturnValue([]);
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("si la RPC falla, responde 500 y marca el job como failed", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "insert viol. constraint" } });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);
    // El último update del job lo dejó en failed (los chunks viejos siguen, la
    // RPC rollbackeó delete+insert al fallar).
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed" });
  });

  it("si la RPC devuelve menos chunks que los esperados, lo trata como error", async () => {
    // Esperados 1, la RPC reporta 0 insertados -> inconsistencia.
    h.rpc.mockResolvedValue({ data: 0, error: null });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed" });
  });

  it("caso exitoso: marca el job como done con la cantidad de chunks", async () => {
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "done", chunks_generated: 1 });
  });
});
