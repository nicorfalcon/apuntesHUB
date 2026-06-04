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
  status: string;
  deleted_at: string | null;
};

const h = vi.hoisted(() => ({
  enabled: vi.fn(),
  meiliSearch: vi.fn(),
  generateQueryEmbedding: vi.fn(),
  rpc: vi.fn(),
  metadataIn: vi.fn(),
  // filas published+no-deleted disponibles en Supabase
  metadataRows: [] as ResumeRow[],
}));

vi.mock("@/lib/search/meilisearch", () => ({
  isMeilisearchBrowseEnabled: h.enabled,
  searchResumeIdsInMeilisearch: h.meiliSearch,
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generateQueryEmbedding: h.generateQueryEmbedding,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: h.rpc,
    from: () => {
      let statusFilter: string | null = null;
      let deletedNull = false;
      const filtered = (ids?: string[]) => {
        let rows = h.metadataRows;
        if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
        if (deletedNull) rows = rows.filter((r) => r.deleted_at == null);
        if (ids) rows = rows.filter((r) => ids.includes(r.id));
        return { data: rows, error: null };
      };
      return {
        select: () => ({
          eq: (col: string, value: string) => {
            if (col === "status") statusFilter = value;
            return {
              is: (isCol: string, isVal: null) => {
                if (isCol === "deleted_at" && isVal === null) deletedNull = true;
                return {
                  in: async (_c: string, ids: string[]) => {
                    h.metadataIn(ids);
                    return filtered(ids);
                  },
                  then: (resolve: (v: ReturnType<typeof filtered>) => unknown) =>
                    resolve(filtered()),
                };
              },
            };
          },
        }),
      };
    },
  }),
}));

import { POST } from "../route";

let ipCounter = 100;
function makeRequest(query: string): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/ai/browse-search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${ipCounter}`,
    },
    body: JSON.stringify({ query }),
  });
}

function pub(id: string, extra: Partial<ResumeRow> = {}): ResumeRow {
  return {
    id,
    title: `Apunte ${id}`,
    subject: "General",
    career: "General",
    university: "Demo",
    description: null,
    file_url: null,
    status: "published",
    deleted_at: null,
    ...extra,
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.metadataRows = [];
  h.generateQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  // Por defecto el hybrid RPC "no existe" → fuerza fallback M1; el RPC vectorial
  // responde OK vacío para que el camino Postgres termine en 200.
  h.rpc.mockImplementation((name: string) => {
    if (name === "search_resumes_hybrid_browse") {
      return Promise.resolve({ data: [], error: { message: "missing" } });
    }
    return Promise.resolve({ data: [], error: null });
  });
});

afterEach(() => warnSpy.mockRestore());

describe("browse-search · integración Meilisearch", () => {
  it("con feature flag false usa Postgres (no llama a Meilisearch)", async () => {
    h.enabled.mockReturnValue(false);
    const res = await POST(makeRequest("le chatelier"));
    expect(res.status).toBe(200);
    expect(h.meiliSearch).not.toHaveBeenCalled();
    // Se usó el camino Postgres: se generó embedding.
    expect(h.generateQueryEmbedding).toHaveBeenCalled();
  });

  it("con feature flag true usa Meilisearch y no toca embeddings/RPC", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockResolvedValue(["a", "b"]);
    h.metadataRows = [pub("a"), pub("b")];

    const res = await POST(makeRequest("le chatelier"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("meilisearch");
    expect(body.results.map((r: { resumeId: string }) => r.resumeId)).toEqual([
      "a",
      "b",
    ]);
    expect(h.generateQueryEmbedding).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("revalida los IDs de Meilisearch contra Supabase", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockResolvedValue(["a", "b"]);
    h.metadataRows = [pub("a"), pub("b")];
    await POST(makeRequest("quimica"));
    expect(h.metadataIn).toHaveBeenCalledWith(["a", "b"]);
  });

  it("si Meilisearch falla, cae a Postgres", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockRejectedValue(new Error("meili down"));
    const res = await POST(makeRequest("le chatelier"));
    expect(res.status).toBe(200);
    // Fallback: se generó embedding y se llamó al RPC.
    expect(h.generateQueryEmbedding).toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalled();
  });

  it("no devuelve un apunte unpublished aunque Meilisearch lo devuelva", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockResolvedValue(["a", "unpub"]);
    // 'unpub' existe pero como draft → no aparece en metadataRows publicadas.
    h.metadataRows = [pub("a"), pub("unpub", { status: "draft" })];
    const res = await POST(makeRequest("x"));
    const body = await res.json();
    expect(body.results.map((r: { resumeId: string }) => r.resumeId)).toEqual([
      "a",
    ]);
  });

  it("no devuelve un apunte deleted aunque Meilisearch lo devuelva", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockResolvedValue(["a", "del"]);
    h.metadataRows = [
      pub("a"),
      pub("del", { deleted_at: "2024-01-01T00:00:00.000Z" }),
    ];
    const res = await POST(makeRequest("x"));
    const body = await res.json();
    expect(body.results.map((r: { resumeId: string }) => r.resumeId)).toEqual([
      "a",
    ]);
  });

  it("preserva el orden de Meilisearch tras revalidar", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockResolvedValue(["b", "a", "c"]);
    h.metadataRows = [pub("a"), pub("b"), pub("c")];
    const res = await POST(makeRequest("x"));
    const body = await res.json();
    const results = body.results as Array<{ resumeId: string; similarity: number }>;
    expect(results.map((r) => r.resumeId)).toEqual(["b", "a", "c"]);
    // Similarity decreciente preserva el orden al ordenar en cliente.
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
  });

  it("deduplica IDs repetidos de Meilisearch", async () => {
    h.enabled.mockReturnValue(true);
    h.meiliSearch.mockResolvedValue(["a", "a", "b", "b", "a"]);
    h.metadataRows = [pub("a"), pub("b")];
    const res = await POST(makeRequest("x"));
    const body = await res.json();
    expect(body.results.map((r: { resumeId: string }) => r.resumeId)).toEqual([
      "a",
      "b",
    ]);
  });
});
