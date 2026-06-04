import { describe, it, expect, beforeEach, vi } from "vitest";
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
  generateQueryEmbedding: vi.fn(),
  metadataRows: [] as ResumeRow[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: h.rpc,
    from: (table: string) => {
      h.from(table);
      let statusFilter: string | null = null;

      return {
        select: (columns: string) => {
          h.metadataSelect(columns);
          return {
            eq: (column: string, value: string) => {
              h.metadataEq(column, value);
              if (column === "status") statusFilter = value;

              return {
                is: async (isColumn: string, isValue: null) => {
                  h.metadataIs(isColumn, isValue);
                  let rows = h.metadataRows;

                  if (statusFilter) {
                    rows = rows.filter((row) =>
                      row.status === undefined || row.status === statusFilter
                    );
                  }
                  if (isColumn === "deleted_at" && isValue === null) {
                    rows = rows.filter((row) => row.deleted_at == null);
                  }

                  return { data: rows, error: null };
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
  h.rpc.mockImplementation((_name: string, params: { min_similarity: number }) =>
    Promise.resolve({
      data: params.min_similarity === 0.32 ? primary : fallback,
      error: null,
    })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  h.metadataRows = [];
  h.generateQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  mockVectorRows([]);
});

describe("POST /api/ai/browse-search", () => {
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
