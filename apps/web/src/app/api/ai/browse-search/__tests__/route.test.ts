import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

type ResumeRow = {
  id: string;
  title: string;
  subject: string;
  career: string;
  university: string;
  description: string | null;
  file_url: string | null;
  status?: string;
  deleted_at?: string | null;
};

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  metadataSelect: vi.fn(),
  metadataEq: vi.fn(),
  metadataIs: vi.fn(),
  metadataIn: vi.fn(),
  generateQueryEmbedding: vi.fn(),
  metadataRows: [] as ResumeRow[],
  metadataError: null as { message: string } | null,
  hybridRows: [] as Array<{ resume_id: string; score: number }>,
  hybridError: { message: "hybrid rpc missing" } as { message: string } | null,
  hybridThrow: null as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: h.rpc,
    from: (table: string) => {
      h.from(table);
      let statusFilter: string | null = null;
      let deletedAtIsNull = false;

      const filteredRows = (ids?: string[]) => {
        if (h.metadataError) {
          return { data: null, error: h.metadataError };
        }

        let rows = h.metadataRows;

        if (statusFilter) {
          rows = rows.filter((row) =>
            row.status === undefined || row.status === statusFilter
          );
        }
        if (deletedAtIsNull) {
          rows = rows.filter((row) => row.deleted_at == null);
        }
        if (ids) {
          rows = rows.filter((row) => ids.includes(row.id));
        }

        return { data: rows, error: null };
      };

      return {
        select: (columns: string) => {
          h.metadataSelect(columns);
          return {
            eq: (column: string, value: string) => {
              h.metadataEq(column, value);
              if (column === "status") statusFilter = value;

              return {
                is: (isColumn: string, isValue: null) => {
                  h.metadataIs(isColumn, isValue);
                  if (isColumn === "deleted_at" && isValue === null) {
                    deletedAtIsNull = true;
                  }

                  return {
                    in: async (inColumn: string, ids: string[]) => {
                      h.metadataIn(inColumn, ids);
                      return filteredRows(ids);
                    },
                    then: (
                      resolve: (value: ReturnType<typeof filteredRows>) => unknown
                    ) => resolve(filteredRows()),
                  };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generateQueryEmbedding: h.generateQueryEmbedding,
}));

import { POST } from "../route";

let ipCounter = 1;

function makeRequest(query: string): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/ai/browse-search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `203.0.113.${ipCounter}`,
    },
    body: JSON.stringify({ query }),
  });
}

function resume(row: Partial<ResumeRow> & Pick<ResumeRow, "id">): ResumeRow {
  return {
    title: "Apunte general",
    subject: "General",
    career: "General",
    university: "Universidad Demo",
    description: null,
    file_url: null,
    status: "published",
    deleted_at: null,
    ...row,
  };
}

function mockVectorRows(
  primary: Array<{ resume_id: string; similarity: number }>,
  fallback: Array<{ resume_id: string; similarity: number }> = []
) {
  h.rpc.mockImplementation((name: string, params: { min_similarity: number }) => {
    if (name === "search_resumes_hybrid_browse") {
      if (h.hybridThrow) throw h.hybridThrow;
      return Promise.resolve({ data: h.hybridRows, error: h.hybridError });
    }

    return Promise.resolve({
      data: params.min_similarity === 0.32 ? primary : fallback,
      error: null,
    });
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.metadataRows = [];
  h.metadataError = null;
  h.hybridRows = [];
  h.hybridError = { message: "hybrid rpc missing" };
  h.hybridThrow = null;
  h.generateQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  mockVectorRows([]);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("POST /api/ai/browse-search", () => {
  it("usa la RPC híbrida cuando está disponible y conserva el contrato de respuesta", async () => {
    h.hybridError = null;
    h.hybridRows = [{ resume_id: "hybrid-title", score: 0.31 }];
    h.metadataRows = [
      resume({
        id: "hybrid-title",
        title: "Algebra lineal",
        subject: "Matematica",
      }),
    ];

    const res = await POST(makeRequest("algebra lineal"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      { resumeId: "hybrid-title", similarity: 0.31 },
    ]);
    expect(h.rpc).toHaveBeenCalledWith(
      "search_resumes_hybrid_browse",
      expect.objectContaining({
        query_text: "algebra lineal",
        vector_weight: 0.55,
        chunk_text_weight: 0.25,
        metadata_weight: 0.2,
      })
    );
    expect(h.rpc).not.toHaveBeenCalledWith(
      "search_chunks_browse",
      expect.anything()
    );
    expect(h.metadataIn).toHaveBeenCalledWith("id", ["hybrid-title"]);
  });

  it("deduplica resultados híbridos por resume_id usando el mejor score", async () => {
    h.hybridError = null;
    h.hybridRows = [
      { resume_id: "dup-1", score: 0.22 },
      { resume_id: "dup-1", score: 0.44 },
    ];
    h.metadataRows = [resume({ id: "dup-1" })];

    const res = await POST(makeRequest("termodinamica"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([{ resumeId: "dup-1", similarity: 0.44 }]);
  });

  it("revalida published/deleted_at sobre resultados híbridos", async () => {
    h.hybridError = null;
    h.hybridRows = [{ resume_id: "draft-1", score: 0.9 }];
    h.metadataRows = [
      resume({
        id: "draft-1",
        title: "Algebra lineal",
        subject: "Matematica",
        status: "draft",
      }),
    ];

    const res = await POST(makeRequest("algebra lineal"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
  });

  it("usa fallback M1 si la RPC híbrida falla", async () => {
    h.hybridError = { message: "function not found" };
    mockVectorRows([{ resume_id: "vector-fallback", similarity: 0.81 }]);

    const res = await POST(makeRequest("neurociencia"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({ resumeId: "vector-fallback", similarity: 0.81 }),
    ]);
    expect(h.rpc).toHaveBeenCalledWith(
      "search_chunks_browse",
      expect.objectContaining({ min_similarity: 0.32 })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[ai:browse] search_resumes_hybrid_browse failed; falling back to M1",
      { message: "function not found" }
    );
  });

  it("usa fallback M1 si la RPC híbrida lanza excepción", async () => {
    h.hybridThrow = new Error("network exploded");
    mockVectorRows([{ resume_id: "vector-after-throw", similarity: 0.77 }]);

    const res = await POST(makeRequest("neurociencia"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({
        resumeId: "vector-after-throw",
        similarity: 0.77,
      }),
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[ai:browse] search_resumes_hybrid_browse failed; falling back to M1",
      { message: "network exploded" }
    );
  });

  it("usa fallback M1 si falla la revalidación de resumes post-M2", async () => {
    h.hybridError = null;
    h.hybridRows = [{ resume_id: "hybrid-unverified", score: 0.93 }];
    h.metadataError = { message: "metadata select failed" };
    mockVectorRows([{ resume_id: "vector-after-revalidation", similarity: 0.74 }]);

    const res = await POST(makeRequest("algebra lineal"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({
        resumeId: "vector-after-revalidation",
        similarity: 0.74,
      }),
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[ai:browse] hybrid resume revalidation failed; falling back to M1",
      { message: "metadata select failed" }
    );
  });

  it("no devuelve apuntes unpublished por metadata", async () => {
    h.metadataRows = [
      resume({
        id: "draft-1",
        title: "Algebra lineal",
        subject: "Matematica",
        status: "draft",
      }),
    ];

    const res = await POST(makeRequest("algebra lineal"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
    expect(h.metadataEq).toHaveBeenCalledWith("status", "published");
    expect(h.metadataIs).toHaveBeenCalledWith("deleted_at", null);
  });

  it("no devuelve apuntes con deleted_at por metadata", async () => {
    h.metadataRows = [
      resume({
        id: "deleted-1",
        title: "Calculo diferencial",
        subject: "Matematica",
        deleted_at: "2026-01-01T00:00:00Z",
      }),
    ];

    const res = await POST(makeRequest("calculo diferencial"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
    expect(h.metadataEq).toHaveBeenCalledWith("status", "published");
    expect(h.metadataIs).toHaveBeenCalledWith("deleted_at", null);
  });

  it("encuentra por metadata aunque vector search no traiga candidatos", async () => {
    h.metadataRows = [
      resume({
        id: "meta-1",
        title: "Algebra lineal",
        subject: "Matematica",
      }),
    ];

    const res = await POST(makeRequest("algebra lineal"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({ resumeId: "meta-1" }),
    ]);
  });

  it("no elimina un buen resultado vectorial aunque no matchee metadata", async () => {
    mockVectorRows([{ resume_id: "vector-1", similarity: 0.86 }]);

    const res = await POST(makeRequest("neurociencia cognitiva"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({ resumeId: "vector-1", similarity: 0.86 }),
    ]);
  });

  it("no rankea career/university-only por encima de un vector claramente mejor", async () => {
    mockVectorRows([{ resume_id: "vector-strong", similarity: 0.72 }]);
    h.metadataRows = [
      resume({
        id: "metadata-weak",
        title: "Material de estudio",
        subject: "General",
        career: "Ingenieria en Sistemas",
        university: "Universidad Nacional de Cordoba",
      }),
    ];

    const res = await POST(makeRequest("universidad nacional sistemas"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0]).toEqual(
      expect.objectContaining({ resumeId: "vector-strong" })
    );
    expect(body.results).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resumeId: "metadata-weak" }),
      ])
    );
  });

  it("capea el score de metadata-only", async () => {
    h.metadataRows = [
      resume({
        id: "meta-capped",
        title: "Calculo integral avanzado",
        subject: "Matematica",
        file_url: "resumes/calculo-integral-avanzado.pdf",
      }),
    ];

    const res = await POST(makeRequest("calculo integral avanzado"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual(
      expect.objectContaining({ resumeId: "meta-capped" })
    );
    expect(body.results[0].similarity).toBeLessThanOrEqual(0.78);
  });
});
