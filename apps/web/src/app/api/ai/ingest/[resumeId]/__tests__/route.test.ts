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
  // Resultado del claim atómico (RPC claim_ai_ingestion_job).
  claimResult: true as boolean,
  claimError: null as { message: string } | null,
  // Resultado de la RPC transaccional de reemplazo de chunks.
  reingestData: null as number | null,
  reingestError: null as { message: string } | null,
  // Despacha por nombre de RPC (claim vs reingest).
  rpc: vi.fn(),
  // Registro de operaciones sobre la DB para verificar invariantes.
  order: [] as string[],
  // Args con los que se invocó cada RPC.
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  // Payloads de update (done/failed) sobre ingestion_jobs.
  jobUpdates: [] as Array<Record<string, unknown>>,
  // Payloads de update sobre resumes (auto-completado de topics).
  resumeUpdates: [] as Array<Record<string, unknown>>,
  // Fuerza un error en el update de resumes (para probar best-effort).
  resumeUpdateError: null as { message: string } | null,
  // Detecta cualquier delete/insert manual sobre document_chunks (no debe ocurrir).
  manualChunkOps: [] as string[],
  // Indexación best-effort en Meilisearch al finalizar la ingesta.
  indexResumeInSearch: vi.fn(),
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
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ fn, args });
      return h.rpc(fn, args);
    },
    from: (table: string) => ({
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
      // ingestion_jobs.update(...).eq() / resumes.update(...).eq()
      update: (payload: Record<string, unknown>) => {
        if (table === "ingestion_jobs") h.jobUpdates.push(payload);
        if (table === "resumes") h.resumeUpdates.push(payload);
        return {
          eq: async () => ({
            error: table === "resumes" ? h.resumeUpdateError : null,
          }),
        };
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

vi.mock("@/lib/search/meilisearch", () => ({
  indexResumeInSearch: h.indexResumeInSearch,
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
    h.rpcCalls = [];
    h.jobUpdates = [];
    h.resumeUpdates = [];
    h.resumeUpdateError = null;
    h.manualChunkOps = [];
    h.claimResult = true;
    h.claimError = null;
    h.reingestData = SAMPLE_CHUNKS.length;
    h.reingestError = null;
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
    h.indexResumeInSearch.mockResolvedValue({ status: "indexed" });
    // Despacha por nombre de RPC: claim atómico vs reemplazo transaccional.
    h.rpc.mockImplementation((fn: string) => {
      if (fn === "claim_ai_ingestion_job") {
        return Promise.resolve({ data: h.claimResult, error: h.claimError });
      }
      if (fn === "reingest_document_chunks") {
        return Promise.resolve({ data: h.reingestData, error: h.reingestError });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  // Helper: las llamadas a reingest_document_chunks (la RPC de chunks).
  function reingestCalls() {
    return h.rpcCalls.filter((c) => c.fn === "reingest_document_chunks");
  }

  it("rechaza si el usuario no es el seller del apunte", async () => {
    h.resumeSingle.mockResolvedValue({
      data: { id: "r1", seller_id: "otro", file_url: "x" },
      error: null,
    });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(403);
    // Ni siquiera intenta reclamar el job de un apunte ajeno.
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("usa la RPC transaccional (no delete+insert manual) tras generar embeddings", async () => {
    await POST(makeRequest(), ctx());

    // Claim (1ra RPC) -> embeddings -> reingest (2da RPC).
    const claimOrder = h.rpc.mock.invocationCallOrder[0];
    const embedOrder = h.generateEmbeddings.mock.invocationCallOrder[0];
    const reingestOrder = h.rpc.mock.invocationCallOrder[1];
    expect(claimOrder).toBeLessThan(embedOrder);
    expect(embedOrder).toBeLessThan(reingestOrder);

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

    const args = reingestCalls()[0].args;
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
    // No reemplaza chunks (la RPC de reingest no se llamó).
    expect(reingestCalls()).toHaveLength(0);
    // Nunca se tocaron los chunks manualmente.
    expect(h.manualChunkOps).toEqual([]);
  });

  it("falla si no se generan chunks (CHUNKS_EMPTY, no llama a la RPC de reingest)", async () => {
    h.chunkPdfPages.mockReturnValue([]);
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("CHUNKS_EMPTY");
    expect(reingestCalls()).toHaveLength(0);
  });

  it("al iniciar, reclama el job con el seller del path y el TTL de stale", async () => {
    await POST(makeRequest(), ctx());
    const claim = h.rpcCalls.find((c) => c.fn === "claim_ai_ingestion_job");
    expect(claim).toBeDefined();
    expect(claim?.args).toMatchObject({
      p_resume_id: "r1",
      p_seller_id: "seller-1",
    });
    expect(claim?.args.p_stale_after_minutes).toBeGreaterThan(0);
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
    // No se reemplazaron chunks (falló antes de la RPC de reingest).
    expect(reingestCalls()).toHaveLength(0);
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
    h.reingestData = null;
    h.reingestError = { message: "insert viol. constraint" };
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.code).toBe("DB_REINGEST_ERROR");
    expect(body.retryable).toBe(true);

    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed", error_code: "DB_REINGEST_ERROR" });
  });

  it("conteo inconsistente de la RPC -> DB_REINGEST_ERROR", async () => {
    h.reingestData = 0;
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "failed", error_code: "DB_REINGEST_ERROR" });
  });

  // --- Parche C: claim atómico contra reingestas concurrentes ---

  it("si no hay job processing, adquiere el lock y continúa hasta done", async () => {
    h.claimResult = true;
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    expect(reingestCalls()).toHaveLength(1);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "done" });
  });

  it("si ya hay un job processing reciente, responde 409 AI_INGEST_ALREADY_PROCESSING", async () => {
    h.claimResult = false;
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("AI_INGEST_ALREADY_PROCESSING");
    expect(body.retryable).toBe(true);
  });

  it("claim=false -> no descarga PDF, no genera embeddings, no llama reingest", async () => {
    h.claimResult = false;
    await POST(makeRequest(), ctx());
    expect(h.download).not.toHaveBeenCalled();
    expect(h.extractPdfPages).not.toHaveBeenCalled();
    expect(h.generateEmbeddings).not.toHaveBeenCalled();
    expect(reingestCalls()).toHaveLength(0);
  });

  it("claim=false -> no marca el job (no pisa el estado del que ya está procesando)", async () => {
    h.claimResult = false;
    await POST(makeRequest(), ctx());
    expect(h.jobUpdates).toHaveLength(0);
  });

  it("job processing stale -> el claim devuelve true y permite reingestar", async () => {
    // El TTL/stale lo decide la RPC en SQL; acá simulamos que devolvió true.
    h.claimResult = true;
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    expect(reingestCalls()).toHaveLength(1);
  });

  it("error de la RPC de claim -> 500 y no procesa", async () => {
    h.claimError = { message: "deadlock detected" };
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(500);
    expect(h.generateEmbeddings).not.toHaveBeenCalled();
    expect(reingestCalls()).toHaveLength(0);
  });

  it("usuario no autorizado recibe 403 ANTES de intentar el claim", async () => {
    h.resumeSingle.mockResolvedValue({
      data: { id: "r1", seller_id: "otro", file_url: "x" },
      error: null,
    });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(403);
    expect(h.rpcCalls).toHaveLength(0);
  });

  it("error después del claim -> marca el job failed con código claro", async () => {
    h.claimResult = true;
    h.generateEmbeddings.mockRejectedValue({ statusCode: 429, message: "rate" });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(429);
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({
      status: "failed",
      error_code: "COHERE_RATE_LIMIT",
    });
  });

  it("reindexa best-effort en Meilisearch al finalizar con éxito", async () => {
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
    // El job quedó marcado 'done' (no afectado por la indexación).
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "done" });
  });

  it("si Meilisearch falla, la ingesta sigue respondiendo éxito", async () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    h.indexResumeInSearch.mockRejectedValue(new Error("meili down"));

    const res = await POST(makeRequest(), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    // No marca el job como failed por culpa de Meilisearch.
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "done" });
    warnSpy.mockRestore();
  });

  it("si Meilisearch no está configurado (skipped), no rompe la ingesta", async () => {
    h.indexResumeInSearch.mockResolvedValue({ status: "skipped" });
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
  });

  // --- Auto-completado de "Temas del apunte" con el índice/TOC (enfoque B) ---

  it("auto-completa topics con los títulos de sección, sin pisar los del vendedor", async () => {
    h.resumeSingle.mockResolvedValue({
      data: {
        id: "r1",
        seller_id: "seller-1",
        file_url: "path/r1.pdf",
        topics: ["Tema vendedor"],
      },
      error: null,
    });
    h.chunkPdfPages.mockReturnValue([
      {
        ...SAMPLE_CHUNKS[0],
        sectionTitle: "Equilibrio químico",
        metadata: { ...SAMPLE_CHUNKS[0].metadata, sectionTitle: "Equilibrio químico" },
      },
    ]);

    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);

    const topicsUpdate = h.resumeUpdates.find((u) => "topics" in u);
    // Vendedor primero, luego el tema derivado del índice.
    expect(topicsUpdate?.topics).toEqual(["Tema vendedor", "Equilibrio químico"]);
  });

  it("no toca topics si los títulos de sección son genéricos (sin señal)", async () => {
    // SAMPLE_CHUNKS trae sectionTitle "Unidad 1" (genérico) -> se descarta.
    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    expect(h.resumeUpdates.find((u) => "topics" in u)).toBeUndefined();
  });

  it("si el auto-completado de topics falla, la ingesta sigue respondiendo éxito", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    h.resumeSingle.mockResolvedValue({
      data: {
        id: "r1",
        seller_id: "seller-1",
        file_url: "path/r1.pdf",
        topics: [],
      },
      error: null,
    });
    h.chunkPdfPages.mockReturnValue([
      {
        ...SAMPLE_CHUNKS[0],
        sectionTitle: "Reacciones reversibles",
        metadata: {
          ...SAMPLE_CHUNKS[0].metadata,
          sectionTitle: "Reacciones reversibles",
        },
      },
    ]);
    // El update de topics (sobre resumes) devuelve error; no debe romper nada.
    h.resumeUpdateError = { message: "rls denied" };

    const res = await POST(makeRequest(), ctx());
    expect(res.status).toBe(200);
    // Igual intentó escribir los topics y siguió a marcar el job done.
    expect(h.resumeUpdates.find((u) => "topics" in u)).toBeDefined();
    const lastJob = h.jobUpdates[h.jobUpdates.length - 1];
    expect(lastJob).toMatchObject({ status: "done" });
    warnSpy.mockRestore();
  });
});
