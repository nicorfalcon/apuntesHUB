import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type ResumeRow = {
  id: string;
  title: string | null;
  description: string | null;
  subject: string | null;
  career: string | null;
  university: string | null;
  seller_id: string | null;
  file_url: string | null;
  status: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const h = vi.hoisted(() => ({
  addDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  updateSettings: vi.fn(),
  search: vi.fn(),
  createIndex: vi.fn(),
  // estado de la "BD" mockeada
  resumeRows: [] as ResumeRow[],
  chunkRowsByResume: {} as Record<string, Array<{ content: string | null }>>,
}));

vi.mock("meilisearch", () => {
  class Meilisearch {
    createIndex = h.createIndex;
    index() {
      return {
        addDocuments: h.addDocuments,
        deleteDocument: h.deleteDocument,
        updateSettings: h.updateSettings,
        search: h.search,
      };
    }
  }
  return { Meilisearch };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "resumes") {
        return {
          select: () => ({
            // Lookup puntual por id: .eq("id", value).maybeSingle()
            // Reindex masivo: .eq("status","published").is("deleted_at",null).order().range()
            eq: (col: string, value: string) => ({
              maybeSingle: async () => {
                const found = h.resumeRows.find((r) => r.id === value) ?? null;
                return { data: found, error: null };
              },
              is: () => ({
                order: () => ({
                  range: async (from: number, to: number) => {
                    const published = h.resumeRows.filter(
                      (r) => r.status === value && r.deleted_at == null
                    );
                    return {
                      data: published.slice(from, to + 1),
                      error: null,
                    };
                  },
                }),
              }),
            }),
          }),
        };
      }
      // document_chunks
      return {
        select: () => ({
          eq: (_col: string, value: string) => ({
            order: () => ({
              limit: async () => ({
                data: h.chunkRowsByResume[value] ?? [],
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

function row(partial: Partial<ResumeRow> & Pick<ResumeRow, "id">): ResumeRow {
  return {
    title: "Apunte demo",
    description: "Descripcion demo",
    subject: "Quimica",
    career: "Ingenieria",
    university: "Universidad Demo",
    seller_id: "seller-1",
    file_url: "resumes/seller-1/le-chatelier.pdf",
    status: "published",
    deleted_at: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: null,
    ...partial,
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  h.addDocuments.mockReset().mockResolvedValue({ taskUid: 1 });
  h.deleteDocument.mockReset().mockResolvedValue({ taskUid: 1 });
  h.updateSettings.mockReset().mockResolvedValue({ taskUid: 1 });
  h.search.mockReset().mockResolvedValue({ hits: [] });
  h.createIndex.mockReset().mockResolvedValue({ taskUid: 1 });
  h.resumeRows = [];
  h.chunkRowsByResume = {};
  process.env.MEILISEARCH_HOST = "http://localhost:7700";
  process.env.MEILISEARCH_API_KEY = "test-key";
  process.env.MEILISEARCH_RESUMES_INDEX = "resumes_test";
  delete process.env.ENABLE_MEILISEARCH_BROWSE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("indexResumeInSearch", () => {
  it("indexa un apunte published con el documento seguro esperado", async () => {
    h.resumeRows = [
      row({
        id: "r1",
        title: "Principio de Le Chatelier",
        subject: "Quimica",
        description: "Equilibrio quimico",
        career: "Ingenieria Quimica",
        university: "UTN",
      }),
    ];
    h.chunkRowsByResume["r1"] = [
      { content: "El principio de Le Chatelier y el equilibrio quimico." },
    ];

    const { indexResumeInSearch } = await import("../meilisearch");
    const result = await indexResumeInSearch("r1");

    expect(result.status).toBe("indexed");
    expect(h.addDocuments).toHaveBeenCalledTimes(1);
    const [docs, opts] = h.addDocuments.mock.calls[0];
    expect(opts).toEqual({ primaryKey: "id" });
    const doc = docs[0];
    expect(doc).toMatchObject({
      id: "r1",
      title: "Principio de Le Chatelier",
      subject: "Quimica",
      description: "Equilibrio quimico",
      career: "Ingenieria Quimica",
      university: "UTN",
      status: "published",
      sellerId: "seller-1",
      tags: [],
      aiSummary: null,
    });
    // chunkTerms es señal de búsqueda derivada, no contenido completo.
    expect(Array.isArray(doc.chunkTerms)).toBe(true);
    expect(doc.chunkTerms).toContain("le chatelier");
    // keywords = aliases académicos curados por reglas (no contenido del PDF).
    expect(Array.isArray(doc.keywords)).toBe(true);
    expect(doc.keywords).toContain("le chatelier");
    expect(doc.keywords).toContain("desplazamiento del equilibrio");
    // No se filtra el contenido completo del chunk.
    expect(JSON.stringify(doc)).not.toContain(
      "El principio de Le Chatelier y el equilibrio quimico."
    );
    expect(doc.fileName).toBe("le-chatelier.pdf");
  });

  it("remueve del índice si el apunte está unpublished (no indexa)", async () => {
    h.resumeRows = [row({ id: "r2", status: "draft" })];
    const { indexResumeInSearch } = await import("../meilisearch");
    const result = await indexResumeInSearch("r2");
    expect(result.status).toBe("removed");
    expect(h.deleteDocument).toHaveBeenCalledWith("r2");
    expect(h.addDocuments).not.toHaveBeenCalled();
  });

  it("remueve del índice si el apunte está soft-deleted", async () => {
    h.resumeRows = [
      row({ id: "r3", deleted_at: "2024-02-02T00:00:00.000Z" }),
    ];
    const { indexResumeInSearch } = await import("../meilisearch");
    const result = await indexResumeInSearch("r3");
    expect(result.status).toBe("removed");
    expect(h.deleteDocument).toHaveBeenCalledWith("r3");
    expect(h.addDocuments).not.toHaveBeenCalled();
  });

  it("no indexa nada (skipped) si Meilisearch no está configurado", async () => {
    delete process.env.MEILISEARCH_HOST;
    delete process.env.MEILISEARCH_API_KEY;
    const { indexResumeInSearch } = await import("../meilisearch");
    const result = await indexResumeInSearch("r1");
    expect(result.status).toBe("skipped");
    expect(h.addDocuments).not.toHaveBeenCalled();
    expect(h.deleteDocument).not.toHaveBeenCalled();
  });

  it("indexa con chunkTerms vacío si el apunte no tiene chunks (no rompe)", async () => {
    h.resumeRows = [row({ id: "r4" })];
    h.chunkRowsByResume["r4"] = [];
    const { indexResumeInSearch } = await import("../meilisearch");
    const result = await indexResumeInSearch("r4");
    expect(result.status).toBe("indexed");
    const [docs] = h.addDocuments.mock.calls[0];
    expect(docs[0].chunkTerms).toEqual([]);
  });
});

describe("reindexPublishedResumes", () => {
  it("no hace nada si no está configurado", async () => {
    delete process.env.MEILISEARCH_HOST;
    const { reindexPublishedResumes } = await import("../meilisearch");
    const summary = await reindexPublishedResumes();
    expect(summary.configured).toBe(false);
    expect(h.addDocuments).not.toHaveBeenCalled();
  });

  it("indexa solo apuntes published y no deleted", async () => {
    h.resumeRows = [
      row({ id: "p1", status: "published" }),
      row({ id: "d1", status: "draft" }),
      row({ id: "del1", status: "published", deleted_at: "2024-03-03T00:00:00.000Z" }),
      row({ id: "p2", status: "published" }),
    ];
    const { reindexPublishedResumes } = await import("../meilisearch");
    const summary = await reindexPublishedResumes();

    expect(summary.configured).toBe(true);
    expect(summary.total).toBe(2);
    expect(summary.indexed).toBe(2);
    // Configura el índice antes de indexar.
    expect(h.updateSettings).toHaveBeenCalled();
    // Solo se subieron p1 y p2.
    const uploadedIds = h.addDocuments.mock.calls
      .flatMap(([docs]) => docs as Array<{ id: string }>)
      .map((d) => d.id)
      .sort();
    expect(uploadedIds).toEqual(["p1", "p2"]);
  });
});

describe("searchResumeIdsInMeilisearch", () => {
  it("devuelve solo IDs y pide solo el atributo id (no campos sensibles)", async () => {
    h.search.mockResolvedValue({
      hits: [{ id: "a" }, { id: "b" }, { id: "" }, {}],
    });
    const { searchResumeIdsInMeilisearch } = await import("../meilisearch");
    const ids = await searchResumeIdsInMeilisearch("le chatelier", 10);
    expect(ids).toEqual(["a", "b"]);
    const [, opts] = h.search.mock.calls[0];
    expect(opts.attributesToRetrieve).toEqual(["id"]);
    // P1(a): no se filtra por `status` en la query; la frontera de seguridad es
    // la revalidación en Supabase. Evita fallar si el índice no tiene `status`
    // filterable (índice autocreado sin settings).
    expect(opts.filter).toBeUndefined();
  });

  it("devuelve [] si no está configurado", async () => {
    delete process.env.MEILISEARCH_API_KEY;
    const { searchResumeIdsInMeilisearch } = await import("../meilisearch");
    const ids = await searchResumeIdsInMeilisearch("x", 10);
    expect(ids).toEqual([]);
    expect(h.search).not.toHaveBeenCalled();
  });
});
