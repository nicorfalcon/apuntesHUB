import { describe, it, expect, beforeEach, vi } from "vitest";

type ResumeRow = {
  id: string;
  topics: string[] | null;
  status?: string | null;
  deleted_at?: string | null;
};

const h = vi.hoisted(() => ({
  resumeRows: [] as ResumeRow[],
  chunkTitlesByResume: {} as Record<string, Array<{ section_title: string | null }>>,
  updates: [] as Array<{ id: string; topics: string[] }>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "resumes") {
        return {
          select: () => ({
            // Puntual: .eq("id", value).maybeSingle()
            // Masivo: .eq("status","published").is("deleted_at",null).order().range()
            eq: (col: string, value: string) => ({
              maybeSingle: async () => ({
                data: h.resumeRows.find((r) => r.id === value) ?? null,
                error: null,
              }),
              is: () => ({
                order: () => ({
                  range: async (from: number, to: number) => {
                    const published = h.resumeRows.filter(
                      (r) => r.status === value && r.deleted_at == null
                    );
                    return { data: published.slice(from, to + 1), error: null };
                  },
                }),
              }),
            }),
          }),
          update: (payload: { topics: string[] }) => ({
            eq: async (_col: string, value: string) => {
              h.updates.push({ id: value, topics: payload.topics });
              return { error: null };
            },
          }),
        };
      }
      // document_chunks
      return {
        select: () => ({
          eq: (_col: string, value: string) => ({
            order: () => ({
              limit: async () => ({
                data: h.chunkTitlesByResume[value] ?? [],
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

beforeEach(() => {
  h.resumeRows = [];
  h.chunkTitlesByResume = {};
  h.updates = [];
});

describe("backfillResumeTopicsFromChunks", () => {
  it("agrega los títulos de sección a topics sin pisar los del vendedor", async () => {
    h.resumeRows = [{ id: "r1", topics: ["Tema vendedor"] }];
    h.chunkTitlesByResume["r1"] = [
      { section_title: "Equilibrio químico" },
      { section_title: "Equilibrio químico" }, // dup
      { section_title: "Constante de equilibrio" },
      { section_title: "Introducción" }, // genérico → descartado
    ];

    const { backfillResumeTopicsFromChunks } = await import("../backfill-topics");
    const result = await backfillResumeTopicsFromChunks("r1");

    expect(result.status).toBe("updated");
    expect(result.added).toBe(2);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toEqual({
      id: "r1",
      topics: ["Tema vendedor", "Equilibrio químico", "Constante de equilibrio"],
    });
  });

  it("no escribe si no hay temas nuevos para agregar (unchanged)", async () => {
    h.resumeRows = [{ id: "r2", topics: ["Equilibrio químico"] }];
    h.chunkTitlesByResume["r2"] = [{ section_title: "equilibrio quimico" }];

    const { backfillResumeTopicsFromChunks } = await import("../backfill-topics");
    const result = await backfillResumeTopicsFromChunks("r2");

    expect(result.status).toBe("unchanged");
    expect(result.added).toBe(0);
    expect(h.updates).toHaveLength(0);
  });

  it("devuelve no-chunks si el apunte no tiene títulos aprovechables", async () => {
    h.resumeRows = [{ id: "r3", topics: [] }];
    h.chunkTitlesByResume["r3"] = [
      { section_title: "Unidad 1" }, // genérico
      { section_title: null },
    ];

    const { backfillResumeTopicsFromChunks } = await import("../backfill-topics");
    const result = await backfillResumeTopicsFromChunks("r3");

    expect(result.status).toBe("no-chunks");
    expect(h.updates).toHaveLength(0);
  });

  it("devuelve not-found si el apunte no existe", async () => {
    const { backfillResumeTopicsFromChunks } = await import("../backfill-topics");
    const result = await backfillResumeTopicsFromChunks("nope");
    expect(result.status).toBe("not-found");
    expect(h.updates).toHaveLength(0);
  });
});

describe("backfillAllPublishedResumesTopics", () => {
  it("recorre solo publicados/no eliminados y resume los conteos", async () => {
    h.resumeRows = [
      { id: "p1", topics: [], status: "published", deleted_at: null },
      { id: "d1", topics: [], status: "draft", deleted_at: null },
      { id: "del1", topics: [], status: "published", deleted_at: "2024-01-01" },
      { id: "p2", topics: ["ya tiene"], status: "published", deleted_at: null },
    ];
    h.chunkTitlesByResume["p1"] = [{ section_title: "Termodinámica" }];
    h.chunkTitlesByResume["p2"] = [{ section_title: "Unidad 1" }]; // genérico → unchanged

    const { backfillAllPublishedResumesTopics } = await import(
      "../backfill-topics"
    );
    const summary = await backfillAllPublishedResumesTopics();

    expect(summary.total).toBe(2); // solo p1 y p2
    expect(summary.updated).toBe(1); // p1
    expect(summary.unchanged).toBe(1); // p2 (no-chunks útiles)
    expect(h.updates.map((u) => u.id)).toEqual(["p1"]);
  });
});
